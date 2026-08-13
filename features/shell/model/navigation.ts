export type PrimarySection = "now" | "news" | "weather" | "politics" | "economy";

export const PRIMARY_NAVIGATION: ReadonlyArray<{
  section: PrimarySection;
  href: string;
  label: string;
}> = [
  { section: "now", href: "/praegu", label: "Praegu" },
  { section: "news", href: "/", label: "Uudised" },
  { section: "weather", href: "/ilm", label: "Ilm" },
  { section: "politics", href: "/reitingud", label: "Poliitika" },
  { section: "economy", href: "/majandus", label: "Majandus" },
];
