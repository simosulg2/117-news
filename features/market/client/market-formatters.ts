import type { MarketWindowState } from "../../../lib/market-types";

const eur = new Intl.NumberFormat("et-EE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usd = new Intl.NumberFormat("et-EE", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

const percent = new Intl.NumberFormat("et-EE", {
  signDisplay: "always",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const tallinnTime = new Intl.DateTimeFormat("et-EE", {
  timeZone: "Europe/Tallinn",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function formatEur(value: number | null): string {
  return value === null ? "—" : eur.format(value);
}

export function formatUsd(value: number | null): string {
  return value === null ? "—" : usd.format(value);
}

export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${percent.format(value)}%`;
}

export function formatTallinnTime(value: string | Date | null): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : tallinnTime.format(date);
}

export function formatAge(seconds: number | null): string {
  if (seconds === null) return "aeg puudub";
  if (seconds < 60) return `${seconds} s tagasi`;
  if (seconds < 3_600) return `${Math.round(seconds / 60)} min tagasi`;
  return `${Math.round(seconds / 3_600)} h tagasi`;
}

export function windowCopy(window: MarketWindowState): Readonly<{
  title: string;
  detail: string;
  healthy: boolean;
}> {
  switch (window) {
    case "open": return {
      title: "Tehinguaken on avatud",
      detail: "Xetra võrdlushind on lukus. Sama päeva order tuleb saata enne 20.00 Eesti aja järgi.",
      healthy: true,
    };
    case "before": return {
      title: "Oota Xetra sulgumist",
      detail: "Tänane kontrollaken algab kell 18.30 Eesti aja järgi.",
      healthy: false,
    };
    case "closed": return {
      title: "Tänane tähtaeg on möödas",
      detail: "Pärast 20.00 saadetud order hinnastatakse järgmise tööpäeva sulgemishinnaga.",
      healthy: false,
    };
    case "weekend": return {
      title: "Turud on nädalavahetuseks suletud",
      detail: "Hinnad on informatiivsed ja neid ei märgita värskeks tehingusignaaliks.",
      healthy: false,
    };
  }
}
