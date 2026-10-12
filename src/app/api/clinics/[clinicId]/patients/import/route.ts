import { NextResponse } from "next/server";
import { requireClinic } from "@/features/auth/access";
import { readImportFile,readImportHeaders } from "@/features/patient-import/parse";
import { importReport } from "@/features/patient-import/model";
export async function POST(request:Request,{params}:{params:Promise<{clinicId:string}>}) {
 const {clinicId}=await params;const {client}=await requireClinic(clinicId,"patients.manage");
 if(request.headers.get("origin")!==new URL(request.url).origin)return NextResponse.json({error:"Cerere invalidă."},{status:400});
 try{if(Number(request.headers.get("content-length"))>2_100_000)throw new Error("Fișierul depășește limita importului.");const form=await request.formData();const file=form.get("file");if(!(file instanceof File))throw new Error("Selectați fișierul.");if(form.get("phase")==="headers")return NextResponse.json(await readImportHeaders(file),{headers:{"Cache-Control":"no-store"}});const rawMapping=form.get("mapping");const mapping=typeof rawMapping==="string"?JSON.parse(rawMapping):undefined;if(mapping&&(!Object.values(mapping).every(value=>typeof value==="string")||Array.isArray(mapping)))throw new Error("Mapare invalidă.");const parsed=await readImportFile(file,mapping);if(parsed.errors.length)return NextResponse.json(parsed,{headers:{"Cache-Control":"no-store"}});
 const {data,error}=await client.rpc("import_patients",{cid:clinicId,records:parsed.records,preview_only:true});if(error)throw new Error("Previzualizarea nu a putut fi pregătită.");return NextResponse.json({...parsed,report:importReport.parse(data)},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Fișierul nu a putut fi citit."},{status:400,headers:{"Cache-Control":"no-store"}});}
}
