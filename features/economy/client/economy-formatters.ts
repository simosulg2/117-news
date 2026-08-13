import type { EconomyComparison, EconomyFrequency, EconomyUnit } from "@/lib/economy-types";

const oneDecimal = new Intl.NumberFormat("et-EE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("et-EE", { maximumFractionDigits: 0 });

export const economyClockFormatter = new Intl.DateTimeFormat("et-EE", {
  timeZone: "Europe/Tallinn",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function formatEconomyValue(value: number, unit: EconomyUnit): string {
  if (unit.id === "percent") return `${oneDecimal.format(value)}%`;
  if (unit.id === "euro") return `${integer.format(value)} €`;
  if (unit.id === "million-euro") return `${oneDecimal.format(value)} mln €`;
  return oneDecimal.format(value);
}

function signed(value: number, digits = 1): string {
  const formatted = digits === 0 ? integer.format(Math.abs(value)) : oneDecimal.format(Math.abs(value));
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatted}`;
}

export function formatComparison(comparison: EconomyComparison, unit: EconomyUnit): string {
  if (comparison.kind === "percent") return `${signed(comparison.value)}%`;
  if (comparison.kind === "percentage-point") return `${signed(comparison.value)} pp`;
  if (unit.id === "million-euro") return `${signed(comparison.value)} mln €`;
  if (unit.id === "euro") return `${signed(comparison.value, 0)} €`;
  return signed(comparison.value);
}

export function previousLabel(frequency: EconomyFrequency): string {
  return frequency === "monthly" ? "Eelmise kuuga" : "Eelmise kvartaliga";
}

export function formatSourceDate(value: string | null): string {
  if (!value) return "uuendusaeg puudub";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "uuendusaeg puudub";
  return new Intl.DateTimeFormat("et-EE", { timeZone: "Europe/Tallinn", dateStyle: "medium" }).format(time);
}
