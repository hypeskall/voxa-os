import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
const url=process.env.MEDICAL_SCANNER_URL,secret=process.env.MEDICAL_SCANNER_SECRET;
if(!url||!secret||secret.length<32)throw new Error('Private scanner acceptance configuration required');
async function submit(bytes,credential=secret){
 const nonce=randomUUID(),sha256=createHash('sha256').update(bytes).digest('hex');
 const response=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${credential}`,'Content-Type':'application/octet-stream','X-Scan-Nonce':nonce,'X-Content-SHA256':sha256},body:bytes,redirect:'error',signal:AbortSignal.timeout(25000)});
 if(!response.ok)return{httpStatus:response.status};
 const result=await response.json();
 const signature=createHmac('sha256',secret).update(`voxa:scan:v1:${nonce}:${sha256}:${result.status}:${result.definitionsUpdatedAt}`).digest();
 const supplied=Buffer.from(result.signature||'','hex');
 if(result.nonce!==nonce||result.sha256!==sha256||supplied.length!==signature.length||!timingSafeEqual(supplied,signature)||Date.now()-Date.parse(result.definitionsUpdatedAt)>48*3600000)throw new Error('Invalid private scanner acceptance verdict');
 return result;
}
try{
 const harmless=Buffer.from('%PDF-1.7\n1 0 obj <</Type/Catalog>> endobj\n%%EOF\n');
 let clean;
 for(let i=0;i<30;i++){clean=await submit(harmless).catch(()=>({httpStatus:503}));if(clean.status==='clean')break;await new Promise(resolve=>setTimeout(resolve,2000));}
 if(clean.status!=='clean')throw new Error('Clean file not accepted by real scanner');
 const eicarResponse=await fetch('https://secure.eicar.org/eicar.com.txt',{signal:AbortSignal.timeout(15000)});
 if(!eicarResponse.ok)throw new Error('Official harmless EICAR fixture unavailable');
 const eicar=Buffer.from(await eicarResponse.arrayBuffer());
 if(eicar.length!==68||!eicar.includes(Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')))throw new Error('Unexpected EICAR fixture');
 if((await submit(eicar)).status!=='infected')throw new Error('Real scanner did not reject EICAR');
 eicar.fill(0);
 if((await submit(harmless,'incorrect-credential')).httpStatus!==401)throw new Error('Private scanner accepted unauthorized access');
 console.log('PASS: real ClamAV accepted a clean file, blocked the official harmless EICAR test and rejected unauthorized access; content-bound signatures and definition freshness verified.');
}catch(error){console.error(error.message);process.exitCode=1;}
