# Private medical-file scanner

Owner-authorized deployment target: a dedicated EU host, at least 2 GB RAM,
private persistent antivirus-definition volume and HTTPS ingress. ClamAV is a
separate trust boundary that sees plaintext transiently; it receives no patient
master key, database/Storage credential, patient name or original filename.

Build this directory's Dockerfile. Mount `/var/lib/clamav` for definitions and
use a memory-backed `/tmp/clamav`; never mount a patient-data volume. Expose only
the HTTPS reverse proxy; keep port 8080 and the Unix ClamAV socket private.
Configure the same random 32-byte `MEDICAL_SCANNER_SECRET` on the scanner and
application server, and set `MEDICAL_SCANNER_URL=https://PRIVATE-HOST/scan`.
Keep request-body logging/APM capture disabled at every ingress. The service
never writes request bodies to files; ClamAV may unpack content into its private
temporary directory, so the memory-backed temporary mount is required.

The service authenticates every request, bounds file size/concurrency/time,
checks the exact content hash, and signs its verdict with the nonce and hash.
An empty/outdated database, scan limit, encrypted inner document, daemon error,
timeout or unknown verdict never returns a clean result. Definitions refresh
in the background; files fail closed after 48 hours without a fresh database.

Before activation: test a harmless PDF, the official EICAR test string, wrong
credential, stopped scanner and stale definitions. Scan existing encrypted
medical objects through a verified operator workflow, then enable the database upload gate.
New direct uploads remain encrypted and unregistered until the scanner clears
them. Failed scans are removed through existing unregistered-object cleanup.
This scanner is not a guarantee that every novel malicious file is detected.
