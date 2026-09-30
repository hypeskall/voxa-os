import { isValid, parseISO } from "date-fns";
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
