import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClinic } from "@/features/auth/access";
import { validateMedicalFile } from "@/lib/file-validation";
import { cleanupUploads } from "@/lib/storage-cleanup";
import { decryptMedicalBytes, isEncryptedMedicalFile, prepareMedicalEncryption } from "@/lib/medical-file-crypto";
import { MAX_MEDICAL_ENVELOPE_BYTES } from "@/lib/medical-file-format";
import {
  uploadMetadata,
  signUploadReceipt,
  readUploadReceipt,
} from "@/features/documents/upload-receipt";
export const maxDuration = 60;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clinicId: string; patientId: string }> },
) {
  const { clinicId: cid, patientId: pid } = await params;
  const { client, user } = await requireClinic(cid, "documents.manage");
  if (
    !z.uuid().safeParse(pid).success ||
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return NextResponse.json({ error: "Cerere invalidă." }, { status: 400 });
  const respond = (data: unknown, status = 200) =>
    NextResponse.json(data, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  try {
    const input = await request.json();
    if (input.phase === "prepare") {
      const meta = uploadMetadata.parse(input.metadata);
      const { data: patient, error: patientError } = await client.rpc(
        "read_workflow_patient",
        { cid, pid },
      );
      if (patientError || !patient)
        throw new Error("Pacientul nu este disponibil în această clinică.");
      if (meta.result) {
        const { data: type, error } = await client
          .from("document_types")
          .select("id")
          .eq("clinic_id", cid)
          .eq("code", "result")
          .eq("active", true)
          .single();
        if (error || !type) throw new Error("Tipul de rezultat nu este activ.");
        meta.document_type_id = type.id;
      }
      const { data: type, error: typeError } = await client
        .from("document_types")
        .select("id")
        .eq("id", meta.document_type_id)
        .eq("clinic_id", cid)
        .eq("active", true)
        .single();
      if (typeError || !type) throw new Error("Tip de document invalid.");
      const path = `${cid}/${pid}/documents/${crypto.randomUUID()}.enc`;
      const encryption = prepareMedicalEncryption(path);
      const receipt = signUploadReceipt({
        ...meta,
        cid,
        pid,
        uid: user.id,
        path,
        expires: Date.now() + 10 * 60 * 1000,
      });
      const { data, error } = await client.storage
        .from("voxa-medical")
        .createSignedUploadUrl(path, { upsert: false });
      if (error || !data)
        throw new Error("Încărcarea nu a putut fi pregătită.");
      return respond({ receipt, url: data.signedUrl, encryption });
    }
    if (input.phase !== "complete" || typeof input.receipt !== "string")
      throw new Error("Cerere invalidă.");
    const meta = readUploadReceipt(input.receipt, cid, pid, user.id);
    // A retry after a lost response returns the already registered document.
    const { data: existing } = await client
      .from("patient_documents")
      .select("id")
      .eq("object_path", meta.path)
      .eq("clinic_id", cid)
      .eq("patient_id", pid)
      .maybeSingle();
    if (existing) return respond({ ok: true, id: existing.id });
    const { data: file, error: downloadError } = await client.storage
      .from("voxa-medical")
      .download(meta.path);
    if (downloadError || !file)
      throw new Error("Fișierul încărcat nu a putut fi verificat.");
    if (file.size > MAX_MEDICAL_ENVELOPE_BYTES) {
      await cleanupUploads(client, "voxa-medical", [meta.path]);
      throw new Error("Fișier invalid sau incomplet.");
    }
    const encrypted = new Uint8Array(await file.arrayBuffer());
    let plaintext: Uint8Array;
    try {
      if (!isEncryptedMedicalFile(encrypted)) throw new Error();
      plaintext = decryptMedicalBytes(encrypted, meta.path);
    } catch {
      await cleanupUploads(client, "voxa-medical", [meta.path]);
      throw new Error("Criptarea fișierului nu a putut fi verificată.");
    }
    const valid =
      plaintext.length === meta.bytes &&
      (await validateMedicalFile(
        new File([Uint8Array.from(plaintext).buffer], meta.file_name, { type: meta.mime }),
        ["application/pdf", "image/png", "image/jpeg", "image/webp"],
        20 * 1024 * 1024,
      ));
    if (!valid) {
      await cleanupUploads(client, "voxa-medical", [meta.path]);
      throw new Error(
        "Fișier invalid sau incomplet. Documentul nu a fost înregistrat.",
      );
    }
    const { data, error } = await client.rpc("save_patient_document", {
      cid,
      pid,
      aid: meta.appointment_id,
      type_id: meta.document_type_id,
      document_title: meta.title,
      path: meta.path,
      file_label: meta.file_name,
      mime: meta.mime,
      bytes: meta.bytes,
      patient_visible: meta.visible_to_patient,
    });
    if (error) {
      const { data: retry } = await client
        .from("patient_documents")
        .select("id")
        .eq("object_path", meta.path)
        .maybeSingle();
      if (retry) return respond({ ok: true, id: retry.id });
      await cleanupUploads(client, "voxa-medical", [meta.path]);
      throw new Error("Documentul nu a putut fi înregistrat.");
    }
    revalidatePath(`/clinics/${cid}/patients/${pid}`);
    revalidatePath(`/clinics/${cid}/clinical-patients/${pid}`);
    revalidatePath("/portal");
    return respond({ ok: true, id: data });
  } catch (error) {
    return respond(
      {
        error:
          error instanceof z.ZodError
            ? "Verificați datele documentului."
            : error instanceof Error
              ? error.message
              : "Încărcarea nu a reușit.",
      },
      400,
    );
  }
}
