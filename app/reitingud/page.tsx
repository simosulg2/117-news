import type { Metadata } from "next";

import { RatingsPortal } from "@/components/ratings-portal";

export const metadata: Metadata = {
  title: "Erakondade reitingud ja Riigikogu projektsioon · 117.ee",
  description:
    "Norstati värske erakondade toetuse ülevaade ja 101-kohalise Riigikogu läbipaistev kohtade projektsioon.",
  openGraph: {
    title: "Riigikogu reitingulaud · 117.ee",
    description:
      "Norstati värske erakondade toetuse ülevaade ja 101-kohalise Riigikogu läbipaistev kohtade projektsioon.",
    type: "website",
    images: [
      {
        url: "https://117.ee/ratings-og.png",
        width: 1672,
        height: 941,
        alt: "117.ee Riigikogu reitingulaua eelvaade",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Riigikogu reitingulaud · 117.ee",
    description: "Erakondade värske toetus ja 101 Riigikogu koha projektsioon.",
    images: ["https://117.ee/ratings-og.png"],
  },
};

export default function RatingsPage() {
  return <RatingsPortal />;
}
