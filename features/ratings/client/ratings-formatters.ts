export const clockFormatter = new Intl.DateTimeFormat("et-EE", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Europe/Tallinn",
});

export const dateFormatter = new Intl.DateTimeFormat("et-EE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Tallinn",
});

export const dateTimeFormatter = new Intl.DateTimeFormat("et-EE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Tallinn",
});

export const numberFormatter = new Intl.NumberFormat("et-EE");
const percentageFormatter = new Intl.NumberFormat("et-EE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function percentage(value: number | null): string {
  return value === null ? "—" : `${percentageFormatter.format(value)}%`;
}

export function signedChange(value: number | null): string {
  if (value === null) return "—";
  if (Math.abs(value) < 0.05) return "0,0";
  return `${value > 0 ? "+" : "−"}${percentageFormatter.format(Math.abs(value))}`;
}

export function relativeAge(value: string, nowMs: number): string {
  const time = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? Date.parse(`${value}T12:00:00Z`)
    : Date.parse(value);
  if (!Number.isFinite(time)) return "—";
  const elapsedMinutes = Math.max(0, Math.floor((nowMs - time) / 60_000));
  if (elapsedMinutes < 1) return "praegu";
  if (elapsedMinutes < 60) return `${elapsedMinutes} min tagasi`;
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return `${hours} t tagasi`;
  return `${Math.floor(hours / 24)} p tagasi`;
}

export function coalitionLabel(seats: number): string {
  const difference = seats - 51;
  if (difference === 0) return "täpselt enamus";
  if (difference > 0) return `enamus +${difference}`;
  return `enamusest ${Math.abs(difference)} puudu`;
}
