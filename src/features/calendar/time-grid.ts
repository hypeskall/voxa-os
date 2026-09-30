export type CalendarTimeConfig = {
  incrementMinutes: number;
  visibleStart: string;
  visibleEnd: string;
};

export function clockToMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) throw new Error("Ora calendarului este invalidă.");
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error("Ora calendarului este invalidă.");
  return hours * 60 + minutes;
}

export function minutesToClock(value: number) {
  const normalized = Math.max(0, Math.min(24 * 60, Math.round(value)));
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function calendarScale(config: CalendarTimeConfig) {
  const startMinute = clockToMinutes(config.visibleStart);
  const endMinute = clockToMinutes(config.visibleEnd);
  if (endMinute <= startMinute) throw new Error("Intervalul vizibil al calendarului este invalid.");
  if (config.incrementMinutes < 5 || config.incrementMinutes > 120)
    throw new Error("Incrementul calendarului este invalid.");
  const totalMinutes = endMinute - startMinute;
  const slotCount = Math.ceil(totalMinutes / config.incrementMinutes);
  const height = Math.max(660, Math.round(totalMinutes * 1.25));
  return { startMinute, endMinute, totalMinutes, slotCount, height };
}

export function timeOptions(config: CalendarTimeConfig) {
  const { startMinute, endMinute } = calendarScale(config);
  const values: string[] = [];
  for (let minute = startMinute; minute < endMinute; minute += config.incrementMinutes)
    values.push(minutesToClock(minute));
  return values;
}

export function snapToIncrement(value: number, incrementMinutes: number) {
  return Math.round(value / incrementMinutes) * incrementMinutes;
}
