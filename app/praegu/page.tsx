import type { Metadata } from "next";
import { NowPortal } from "@/components/now-portal";

export const metadata: Metadata = {
  title: "Praegu · 117.ee",
  description: "Isiklik ülevaade Eesti uudiste, Võru ilma, poliitika ja majanduse olulisematest muutustest.",
};

export default function NowPage() {
  return <NowPortal />;
}
