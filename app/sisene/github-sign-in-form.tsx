"use client";

import { useEffect, useRef, useState } from "react";

type GithubSignInFormProps = Readonly<{
  configured: boolean;
  onStandardSignIn: (formData: FormData) => Promise<void>;
  onInvitedSignIn: (formData: FormData) => Promise<void>;
}>;

function takeInviteFromFragment(): string {
  const parameters = new URLSearchParams(window.location.hash.slice(1));
  const invite = parameters.get("invite")?.trim() ?? "";
  if (window.location.hash) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }
  return invite;
}

export function GithubSignInForm({
  configured,
  onStandardSignIn,
  onInvitedSignIn,
}: GithubSignInFormProps) {
  const [ready, setReady] = useState(false);
  const [invite, setInvite] = useState("");
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setInvite(takeInviteFromFragment());
    setReady(true);
  }, []);

  return (
    <>
      <form
        action={invite ? onInvitedSignIn : onStandardSignIn}
        className="mt-5"
      >
        {invite && <input type="hidden" name="invite" value={invite} />}
        <label className="mb-3 flex min-h-11 cursor-pointer items-center gap-3 border border-[#c5d0d7] bg-[#f6f8f9] px-3 text-xs font-semibold text-[#526878] dark:border-[#263d50] dark:bg-[#0d2030] dark:text-[#9bb0bf]">
          <input
            type="checkbox"
            name="remember"
            value="1"
            className="size-4 shrink-0 accent-[#245fae]"
          />
          <span>
            Jää sisselogituks
            <span className="font-normal text-[#6f8493] dark:text-[#7890a2]"> (30 päeva tegevusetust)</span>
          </span>
        </label>
        <button
          type="submit"
          disabled={!configured || !ready}
          className="flex min-h-11 w-full items-center justify-center gap-3 border border-[#102538] bg-[#102538] px-4 text-sm font-bold text-white outline-none hover:border-[#245fae] hover:bg-[#17344d] focus-visible:ring-2 focus-visible:ring-signal disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#58768b]"
        >
          <span aria-hidden="true" className="border border-[#58768b] px-1.5 py-0.5 text-[10px] tracking-wider">GH</span>
          {invite
            ? "Võta kutse GitHubiga vastu"
            : "Logi GitHubi kaudu sisse"}
        </button>
      </form>
      <p className="mt-4 text-[11px] leading-5 text-[#526878] dark:text-[#7890a2]">
        {invite
          ? "Kutse on ühekordne. Pärast kinnitamist saad kohe ühise klassi- ja rutiiniplaani isikliku koopia — midagi ei pea nullist sisestama."
          : "GitHubi kasutatakse ainult sinu konto tuvastamiseks. Me ei küsi juurdepääsu sinu repositooriumidele."}
      </p>
    </>
  );
}
