import type { Metadata } from "next";

import { WeatherPortal } from "@/components/weather-portal";

export const metadata: Metadata = {
  title: "Võru ilm · 117.ee",
  description: "Võru mõõdetud ilm, ilmaajalugu, prognoos ja sademeradar ühes vaates.",
};

export default function WeatherPage() {
  return <WeatherPortal />;
}
