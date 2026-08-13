import type { Metadata } from "next";

import { PoliticalFinancePortal } from "@/components/political-finance-portal";

export const metadata: Metadata = {
  title: "Erakondade raha · 117.ee",
  description: "ERJK ametlikel kvartaliaruannetel põhinev erakondade tulude, kulude ja annetuste andmelaud.",
};

export default function PoliticalFinancePage() {
  return <PoliticalFinancePortal />;
}
