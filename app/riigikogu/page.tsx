import type { Metadata } from "next";
import { RiigikoguPortal } from "@/components/riigikogu-portal";

export const metadata: Metadata = {
  title: "Riigikogu töölaud · 117.ee",
  description: "XV Riigikogu ametlik päevakord, hiljutised hääletused ja menetluses eelnõud.",
};

export default function RiigikoguPage() {
  return <RiigikoguPortal />;
}
