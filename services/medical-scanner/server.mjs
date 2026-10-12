import http from 'node:http';
import net from 'node:net';
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const limit=20*1024*1024;
export function clamdCommand(command,bytes, socketPath=process.env.CLAMD_SOCKET||'/run/clamav/clamd.ctl') {
 return new Promise((resolve,reject)=>{
  const socket=net.createConnection(socketPath);let response='';let settled=false;
  const finish=(error,value)=>{if(settled)return;settled=true;socket.destroy();if(error)reject(error);else resolve(value);};
  socket.setTimeout(20000,()=>finish(new Error('timeout')));
  socket.on('error',()=>finish(new Error('scanner unavailable')));
  socket.on('data',chunk=>{response+=chunk.toString('utf8');if(response.length>4096)return finish(new Error('oversized verdict'));if(response.includes('\0'))finish(null,response.split('\0')[0]);});
  socket.on('end',()=>finish(new Error('incomplete verdict')));
  socket.on('connect',()=>{
   socket.write(`z${command}\0`);
   if(bytes){for(let start=0;start<bytes.length;start+=65536){const chunk=bytes.subarray(start,start+65536),size=Buffer.alloc(4);size.writeUInt32BE(chunk.length);socket.write(size);socket.write(chunk);}socket.write(Buffer.alloc(4));}
  });
 });
}
export async function scan(bytes) {
 const version=await clamdCommand('VERSION');
 const match=/^ClamAV [^/]+\/\d+\/(.+)$/.exec(version);
 const updated=match?Date.parse(match[1]):NaN;
 if(!Number.isFinite(updated)||Date.now()-updated>48*3600000||updated>Date.now()+300000)throw new Error('definitions unavailable');
 const verdict=await clamdCommand('INSTREAM',bytes);
 const status=verdict==='stream: OK'?'clean':/^stream: .+ FOUND$/.test(verdict)?'infected':'unavailable';
 return {status,definitionsUpdatedAt:new Date(updated).toISOString()};
}
export function scannerServer(secret, scanFunction=scan) {
 if(typeof secret!=='string'||secret.length<32||/\s/.test(secret))throw new Error('Private scanner credential required');
 let active=0;
 return http.createServer({requestTimeout:30000,headersTimeout:10000},async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.setHeader('X-Content-Type-Options','nosniff');
  const auth=Buffer.from(req.headers.authorization||''),expected=Buffer.from(`Bearer ${secret}`);
  if(auth.length!==expected.length||!timingSafeEqual(auth,expected)){res.writeHead(401);res.end('{"error":"unauthorized"}');return;}
  if(req.url!=='/scan'||req.method!=='POST'){res.writeHead(404);res.end('{}');return;}
  const nonce=req.headers['x-scan-nonce'],sha=req.headers['x-content-sha256'];
  if(typeof nonce!=='string'||!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(nonce)||typeof sha!=='string'||! /^[a-f0-9]{64}$/.test(sha)||req.headers['content-type']!=='application/octet-stream'){res.writeHead(400);res.end('{}');return;}
  if(active>=2){res.writeHead(503);res.end('{}');return;}active++;
  let bytes;
  try{
   const parts=[];let length=0;
   for await(const part of req){length+=part.length;if(length>limit)throw new Error('oversize');parts.push(part);}
   bytes=Buffer.concat(parts);
   if(!bytes.length||createHash('sha256').update(bytes).digest('hex')!==sha)throw new Error('content mismatch');
   const result=await scanFunction(bytes);
   if(!['clean','infected','unavailable'].includes(result.status)||!Number.isFinite(Date.parse(result.definitionsUpdatedAt)))throw new Error('invalid verdict');
   const signature=createHmac('sha256',secret).update(`voxa:scan:v1:${nonce}:${sha}:${result.status}:${result.definitionsUpdatedAt}`).digest('hex');
   res.end(JSON.stringify({...result,nonce,sha256:sha,signature}));
  }catch{res.writeHead(503);res.end('{"error":"scanner unavailable"}');}
  finally{bytes?.fill(0);active--;}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const server=scannerServer(process.env.MEDICAL_SCANNER_SECRET);
 server.listen(Number(process.env.PORT||8080),'0.0.0.0');
}
