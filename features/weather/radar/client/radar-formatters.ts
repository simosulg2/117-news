const timeFormatter = new Intl.DateTimeFormat("et-EE", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Tallinn",
});

export const exactTimeFormatter = new Intl.DateTimeFormat("et-EE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Tallinn",
});

export const precipitationLegend = [
  { value: "0,05", color: "#86c8ff" },
  { value: "0,1", color: "#18a9ff" },
  { value: "0,3", color: "#00d7d7" },
  { value: "0,5", color: "#00df72" },
  { value: "1", color: "#a9e900" },
  { value: "2", color: "#ffe000" },
  { value: "4", color: "#ff9d00" },
  { value: "8", color: "#ff4b18" },
  { value: "16", color: "#df163d" },
  { value: "50", color: "#c026d3" },
] as const;

export function formatFrameTime(time: string): string {
  return timeFormatter.format(new Date(time)).replace(",", "");
}
