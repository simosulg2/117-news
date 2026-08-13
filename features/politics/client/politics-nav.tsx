type PoliticsPage = "ratings" | "parliament" | "finance";

const links: ReadonlyArray<{ page: PoliticsPage; href: string; label: string }> = [
  { page: "ratings", href: "/reitingud", label: "Reitingud" },
  { page: "parliament", href: "/riigikogu", label: "Riigikogu" },
  { page: "finance", href: "/erakonnaraha", label: "Raha" },
];

export function PoliticsNav({ activePage }: { activePage: PoliticsPage }) {
  return (
    <nav aria-label="Poliitika" className="no-scrollbar flex min-w-0 overflow-x-auto border-x border-[#263d50]">
      {links.map((link) => (
        <a
          key={link.page}
          href={link.href}
          aria-current={link.page === activePage ? "page" : undefined}
          className={`flex min-h-9 shrink-0 items-center border-r border-[#263d50] px-4 text-[11px] font-bold uppercase tracking-[0.06em] outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal ${
            link.page === activePage
              ? "bg-signal text-[#07131f]"
              : "text-[#9fb0bd] hover:bg-[#102538] hover:text-white"
          }`}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}
