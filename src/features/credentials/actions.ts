"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/features/auth/actions";
import { requireClinic } from "@/features/auth/access";
import { validateMedicalFile, type MedicalMime } from "@/lib/file-validation";
import { MAX_UPLOAD_BYTES } from "@/lib/medical-storage";
import { cleanupUploads } from "@/lib/storage-cleanup";

const imageTypes: MedicalMime[] = ["image/png","image/jpeg","image/webp"];
export async function saveDoctorCredentials(cid:string,did:string,_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireClinic(cid,"credentials.manage");
 const uid=z.union([z.uuid(),z.literal("")]).safeParse(String(form.get("staff_user_id")??"")); if(!uid.success)return{error:"Contul selectat nu este valid."};
 const uploaded:string[]=[];
 const total=["signature","stamp"].reduce((sum,key)=>{const value=form.get(key);return sum+(value instanceof File?value.size:0);},0);if(total>MAX_UPLOAD_BYTES)return{error:"Semnătura și parafa pot avea împreună cel mult 3 MB."};
 async function upload(field:string){const file=form.get(field);if(!(file instanceof File)||!file.size)return null;const mime=await validateMedicalFile(file,imageTypes,MAX_UPLOAD_BYTES);if(!mime)throw new Error("Fișier invalid");const path=`${cid}/doctors/${did}/${field}/${crypto.randomUUID()}`;uploaded.push(path);const {error}=await client.storage.from("voxa-medical").upload(path,file,{contentType:mime,upsert:false});if(error)throw error;return{path,mime};}
 try{const signature=await upload("signature");const stamp=await upload("stamp");const {error}=await client.rpc("set_doctor_credentials",{cid,did,staff_uid:uid.data||null,signature_path:signature?.path??null,signature_type:signature?.mime??null,stamp_path:stamp?.path??null,stamp_type:stamp?.mime??null});if(error)throw error;revalidatePath(`/clinics/${cid}/doctors/${did}`);return{success:"Contul profesional și imaginile scanate au fost actualizate."};}catch{const cleanup=await cleanupUploads(client,"voxa-medical",uploaded);return{error:"Datele nu au putut fi salvate. Verificați rolul contului și conținutul fișierelor."+cleanup};}
}
