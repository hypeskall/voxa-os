"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/features/auth/actions";
import { requireClinic } from "@/features/auth/access";
import { validateMedicalFile, type MedicalMime } from "@/lib/file-validation";

const imageTypes: MedicalMime[] = ["image/png","image/jpeg","image/webp"];
export async function saveDoctorCredentials(cid:string,did:string,_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireClinic(cid,"credentials.manage");
 const uid=z.union([z.uuid(),z.literal("")]).safeParse(String(form.get("staff_user_id")??"")); if(!uid.success)return{error:"Contul selectat nu este valid."};
 const uploaded:string[]=[];
 async function upload(field:string){const file=form.get(field);if(!(file instanceof File)||!file.size)return null;const mime=await validateMedicalFile(file,imageTypes,5*1024*1024);if(!mime)throw new Error("Fișier invalid");const path=`${cid}/doctors/${did}/${field}/${crypto.randomUUID()}`;const {error}=await client.storage.from("voxa-medical").upload(path,file,{contentType:mime,upsert:false});if(error)throw error;uploaded.push(path);return{path,mime};}
 try{const signature=await upload("signature");const stamp=await upload("stamp");const {error}=await client.rpc("set_doctor_credentials",{cid,did,staff_uid:uid.data||null,signature_path:signature?.path??null,signature_type:signature?.mime??null,stamp_path:stamp?.path??null,stamp_type:stamp?.mime??null});if(error)throw error;revalidatePath(`/clinics/${cid}/doctors/${did}`);return{success:"Contul profesional și imaginile scanate au fost actualizate."};}catch{if(uploaded.length)await client.storage.from("voxa-medical").remove(uploaded);return{error:"Datele nu au putut fi salvate. Verificați rolul contului și conținutul fișierelor."};}
}
