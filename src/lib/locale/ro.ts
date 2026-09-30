export const appointmentStatusLabels: Record<string, string> = {
  PENDING: "În așteptare",
  CONFIRMED: "Confirmată",
  ARRIVED: "Sosit",
  IN_PROGRESS: "În desfășurare",
  COMPLETED: "Finalizată",
  CANCELLED: "Anulată",
  NO_SHOW: "Neprezentat",
};

export const appointmentSourceLabels: Record<string, string> = {
  RECEPTION: "Recepție",
  WEBSITE: "Site public",
  PATIENT_PORTAL: "Portal pacient",
  API: "Integrare",
  VOICE_AGENT: "Asistent vocal",
};

export const appointmentEventLabels: Record<string, string> = {
  CREATED: "Programare creată",
  UPDATED: "Date actualizate",
  RESCHEDULED: "Programare mutată",
  RESIZED: "Durată ajustată",
  CANCELLED: "Programare anulată",
  STATUS_CHANGED: "Status schimbat",
  RESOURCES_ASSIGNED: "Resurse alocate",
  DUPLICATE_OVERRIDE: "Avertisment confirmat",
};

export function formatRomanianDate(isoDate: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...options,
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

export function isoToRomanian(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return year && month && day ? `${day}.${month}.${year}` : "";
}

export function romanianToIso(value: string) {
  const match = value.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? null : iso;
}
