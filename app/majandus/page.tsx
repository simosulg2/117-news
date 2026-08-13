import type { Metadata } from "next";

import { EconomyPortal } from "@/components/economy-portal";

export const metadata: Metadata = {
  title: "Eesti majandusnäitajad · 117.ee",
  description: "Eesti hindade, palkade, tööturu, SKP, väliskaubanduse ja Võrumaa ametlik majanduslaud.",
  openGraph: {
    title: "Eesti majanduslaud · 117.ee",
    description: "Ametlikud kuu- ja kvartalinäitajad koos võrreldavate muutuste ja Võrumaa vaatega.",
    type: "website",
  },
};

export default function EconomyPage() {
  return <EconomyPortal />;
}
