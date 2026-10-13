import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readEnv} from './staging-env.mjs';
// This operator tool prepares a local import only. It never uploads keys,
// places them in an archive, prints them, or claims vault recovery is complete.
const source=path.resolve(process.env.RECOVERY_KEY_SOURCE_ROOT||process.cwd());
const items=[];
let createdFile, descriptor;
try{
 for(const [environment,ref] of [['production','fibcbsdattoqiyizzeda'],['staging','wlnrfjrjkyywqyvsngps']]){
  const app=readEnv(path.join(source,`.env.${environment}.local`));
  const encryption=readEnv(path.join(source,`.env.patient-encryption.${environment}.local`));
  if(app.NEXT_PUBLIC_SUPABASE_URL!==`https://${ref}.supabase.co`||! /^[a-f0-9]{64}$/.test(app.BACKUP_ENCRYPTION_KEY||''))throw new Error('Named recovery configuration mismatch');
  const ring=JSON.parse(encryption.PATIENT_ENCRYPTION_KEYRING||'');
  if(typeof ring.active!=='string'||! /^[a-f0-9]{64}$/.test(ring.index||'')||!ring.keys?.[ring.active]||Object.values(ring.keys).some(key=>! /^[a-f0-9]{64}$/.test(key)))throw new Error('Patient recovery keyring invalid');
  items.push({name:`Voxa ${environment} patient encryption recovery`,environment,projectRef:ref,kind:'patient-keyring',value:ring});
  items.push({name:`Voxa ${environment} backup archive recovery`,environment,projectRef:ref,kind:'backup-aes256-key',value:app.BACKUP_ENCRYPTION_KEY});
 }
 const destination=path.join(source,'.backups','portable-recovery-keys.private.json');
 fs.mkdirSync(path.dirname(destination),{recursive:true});
 const bytes=Buffer.from(JSON.stringify({format:1,createdAt:new Date().toISOString(),items},null,2));
 // Restrict an empty file before writing any key bytes. POSIX mode alone does
 // not restrict Windows ACLs. Keep the descriptor open to avoid path replacement.
 descriptor=fs.openSync(destination,'wx',0o600);
 createdFile=destination;
 if(process.platform==='win32'){
  const owner=process.env.USERDOMAIN&&process.env.USERNAME?`${process.env.USERDOMAIN}\\${process.env.USERNAME}`:process.env.USERNAME;
  if(!owner)throw new Error('Recovery owner unavailable');
  execFileSync(path.join(process.env.SystemRoot||'C:\\Windows','System32','icacls.exe'),[destination,'/inheritance:r','/grant:r',`${owner}:(F)`,'*S-1-5-18:(F)'],{stdio:'ignore',windowsHide:true});
 }
 fs.writeFileSync(descriptor,bytes);
 fs.closeSync(descriptor);descriptor=undefined;
 fs.writeFileSync(path.join(source,'.backups','recovery-key-export.receipt.json'),JSON.stringify({format:1,itemCount:items.length,sha256:createHash('sha256').update(bytes).digest('hex'),preparedAt:new Date().toISOString(),passwordManagerImportVerified:false}));
 console.log('Prepared four recovery entries locally for owner-controlled password-manager import. No keys displayed or transferred; vault import and off-device recovery remain pending.');
}catch(error){
 if(descriptor!==undefined){try{fs.closeSync(descriptor);}catch{}}
 if(createdFile){try{fs.rmSync(createdFile);}catch{}}
 console.error(error.code==='EEXIST'?'A private recovery import already exists; no overwrite performed.':'Recovery-key preparation failed; private values suppressed.');process.exitCode=1;
}
