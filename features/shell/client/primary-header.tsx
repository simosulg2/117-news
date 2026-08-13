type PrimarySection = "news" | "weather" | "politics";

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
  padding: string;
}> = [
  { section: "news", href: "/", label: "Uudised", padding: "px-3" },
  { section: "weather", href: "/ilm", label: "Ilm", padding: "px-3" },
  { section: "politics", href: "/reitingud", label: "Poliitika", padding: "px-2" },
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
    <div className="flex min-h-12 items-center justify-between gap-2 border-b border-[#263d50] sm:gap-4">
      <div className="flex min-w-0 self-stretch">
        <a href="/" className="flex items-center gap-2.5 outline-none focus-visible:ring-1 focus-visible:ring-signal" aria-label="117.ee avaleht">
          <span className="block size-10 shrink-0" aria-hidden="true">
            <img src="/117.png" alt="" className="size-full object-contain" />
          </span>
          <span className="hidden text-[13px] font-medium text-[#8da1b0] lg:inline">{tagline}</span>
        </a>

        <nav aria-label="Põhinavigatsioon" className="ml-2 flex border-l border-[#263d50] sm:ml-4">
          {links.map((link) => {
            const active = link.section === activeSection;
            return (
              <a
                key={link.section}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 items-center border-r border-[#263d50] ${link.padding} text-xs outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal sm:px-4 ${
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
      </div>

      <div className="flex items-center gap-3 text-xs">
        <span className="hidden text-[#8da1b0] sm:inline">
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
