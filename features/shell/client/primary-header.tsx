type PrimarySection = "news" | "weather" | "politics" | "schedule";

type PrimaryHeaderProps = {
  activeSection: PrimarySection;
  tagline: string;
  statusText: string;
  statusHealthy: boolean;
  clockText: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  statusAriaLive?: boolean;
};

const links: ReadonlyArray<{
  section: PrimarySection;
  href: string;
  label: string;
}> = [
  { section: "news", href: "/", label: "Uudised" },
  { section: "weather", href: "/ilm", label: "Ilm" },
  { section: "politics", href: "/reitingud", label: "Poliitika" },
  { section: "schedule", href: "/ajakava", label: "Ajakava" },
];

export function PrimaryHeader({
  activeSection,
  tagline,
  statusText,
  statusHealthy,
  clockText,
  theme,
  onToggleTheme,
  statusAriaLive = false,
}: PrimaryHeaderProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 border-b border-[#263d50] sm:flex sm:min-h-12 sm:justify-between sm:gap-3">
      <a href="/" className="flex min-h-12 min-w-0 items-center gap-2.5 outline-none focus-visible:ring-1 focus-visible:ring-signal" aria-label="117.ee avaleht">
        <span className="block size-10 shrink-0" aria-hidden="true">
          <img src="/117.png" alt="" className="size-full object-contain" />
        </span>
        <span className="hidden truncate text-[13px] font-medium text-[#8da1b0] lg:inline">{tagline}</span>
      </a>

      <nav aria-label="Põhinavigatsioon" className="order-3 col-span-2 flex w-full self-stretch border-x border-t border-[#263d50] sm:order-none sm:ml-1 sm:w-auto sm:border-y-0 sm:border-r-0 sm:border-l">
        {links.map((link) => {
          const active = link.section === activeSection;
          return (
            <a
              key={link.section}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-10 flex-1 items-center justify-center border-r border-[#263d50] px-1 text-[11px] outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal sm:min-h-12 sm:flex-none sm:px-3 sm:text-xs lg:px-4 ${
                active
                  ? "bg-[#102538] font-bold text-signal"
                  : "font-semibold text-[#a9b7c2] hover:bg-[#102538] hover:text-white"
              }`}
            >
              {link.label}
            </a>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 text-xs sm:ml-auto">
        <span className="hidden text-[#8da1b0] lg:inline">
          <b
            aria-live={statusAriaLive ? "polite" : undefined}
            className={statusHealthy ? "text-[#55d6b2]" : "text-[#b6a3ff]"}
          >
            {statusText}
          </b>
          <span aria-hidden="true" className="ml-3 tabular-nums text-[#8295a4]">{clockText}</span>
        </span>
        <button
          type="button"
          onClick={onToggleTheme}
          className="min-h-8 border border-[#3b5870] px-2.5 font-bold text-[#c7d5df] outline-none hover:border-signal hover:text-[#7db0ff] focus-visible:ring-1 focus-visible:ring-signal"
          aria-label={theme === "dark" ? "Kasuta heledat kujundust" : "Kasuta tumedat kujundust"}
        >
          {theme === "dark" ? "Hele" : "Tume"}
        </button>
      </div>
    </div>
  );
}
