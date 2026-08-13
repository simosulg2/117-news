import type { ReactNode } from "react";

type PageFooterProps = {
  label: string;
  children: ReactNode;
};

export function PageFooter({ label, children }: PageFooterProps) {
  return (
    <footer className="border-t border-[#9fb2c0] bg-[#dfe8ee] dark:border-[#35536a] dark:bg-[#0b1b29]">
      <div className="mx-auto flex max-w-[96rem] flex-col gap-2 px-3 py-3 text-[11px] text-[#526878] dark:text-[#7890a2] sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-7">
        <span><b className="text-[#245fae] dark:text-signal">117.ee</b> · {label}</span>
        <span>{children}</span>
      </div>
    </footer>
  );
}
