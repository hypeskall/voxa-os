import { isValid, parseISO } from "date-fns";
export function localDate(timeZone: string, date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}
export function formatInTimeZone(value: string, timeZone: string) {
  const date = parseISO(value);
  return isValid(date)
    ? new Intl.DateTimeFormat("ro-RO", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone,
      }).format(date)
    : "Dată indisponibilă";
}
