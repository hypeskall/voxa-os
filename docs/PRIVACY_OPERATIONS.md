# Privacy operations

The application supplies tenant isolation, least-privilege roles, private Storage, append-only audit, patient JSON exports, and recorded requests/reviews. It does not claim GDPR certification or certification as an electronic medical record system.

## Export

Only OWNER-level `organization.manage` permission can request `/api/clinics/[clinicId]/patients/[patientId]/export`. The server verifies current location access; PostgreSQL checks the patient belongs to that clinic. The export includes the patient's administrative data, appointment records, notes, document/result metadata/content and manual communications. It has `private, no-store` and attachment headers, and generates an audit event. Raw files must be downloaded separately through existing short-lived authorized document/result links. The response must be delivered to a verified requester through a controlled process, never an analytics system.

## Erasure or anonymization request

1. Verify requester identity and record a reason from the patient profile's **Date personale** section.
2. An OWNER reviews the request in **Setări → Confidențialitate**, documents the applicable retention decision, and approves or rejects it. The application does not decide legal retention periods.
3. The clinic's responsible operator executes the approved retention process across PostgreSQL, stored originals/derived PDFs, notification recipients/outboxes, external providers and backups. Medical results and version trails can contain identifying free text; renaming a patient alone does not anonymize those files.
4. Record completion and the process performed in the request review. This is a recorded attestation of the operator's process, not an automatic erasure button.

There are no app-level hard-delete grants on clinical records or audit logs. Archiving hides operational records while preserving history; it must not be described as deletion/anonymization. Existing document metadata preserves references; unregistered failed-upload objects can be removed safely by their authorized uploader. Registered medical objects require the retention workflow.

## Outside-software requirements

Privacy policy, legal basis, DPA, processor/subprocessor assessment, regional hosting choices, retention schedule, access review, staff training, identity verification, breach response and backup-restoration procedures must be approved by the clinic and its advisors. The organization setting `privacy_settings.retention_review_required` is a readiness marker, not an executable retention policy. No custom backup engine or automatic legal-policy decisions are implemented.
