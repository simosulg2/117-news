import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { auth, signIn } from "@/auth";
import { GithubSignInForm } from "@/app/sisene/github-sign-in-form";
import { SignInThemeToggle } from "@/app/sisene/sign-in-theme-toggle";
import { beginInvitedGithubSignIn } from "@/features/auth/server/schedule-invite-actions";
import { clearPendingScheduleInviteToken } from "@/features/auth/server/schedule-invite-cookie.server";
import {
  setPendingScheduleSessionPreference,
  wantsRememberedScheduleSession,
} from "@/features/auth/server/schedule-session-preference.server";
import {
  getScheduleAuthState,
  SCHEDULE_PATH,
  SCHEDULE_SIGN_IN_PATH,
} from "@/features/auth/server/schedule-auth-policy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sisene ajakavasse · 117.ee",
  description: "Turvaline sisselogimine 117.ee privaatsesse ajakavasse.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

type SignInPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

function errorMessage(error: string | string[] | undefined): string | null {
  if (error === "AccessDenied") {
    return "Selle GitHubi kontoga puudub ligipääs ajakavale.";
  }
  if (error === "Configuration") {
    return "Sisselogimine pole praegu seadistatud. Proovi hiljem uuesti.";
  }
  if (error === "InvalidInvite") {
    return "Kutse on vigane, aegunud või juba kasutatud.";
  }
  return error ? "Sisselogimine ei õnnestunud. Proovi uuesti." : null;
}

async function beginGithubSignIn(formData: FormData) {
  "use server";

  if (!getScheduleAuthState(process.env).configured) {
    redirect(`${SCHEDULE_SIGN_IN_PATH}?error=Configuration`);
  }
  await setPendingScheduleSessionPreference(
    wantsRememberedScheduleSession(formData.get("remember")),
  );
  await clearPendingScheduleInviteToken();
  await signIn("github", { redirectTo: SCHEDULE_PATH });
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const state = getScheduleAuthState(process.env);
  if (state.developmentBypass) redirect(SCHEDULE_PATH);

  if (state.configured) {
    let session: Session | null = null;
    try {
      session = await auth();
    } catch {
      // Render a closed sign-in state if Auth.js cannot read the session.
    }
    if (session?.user.scheduleAccess) {
      redirect(SCHEDULE_PATH);
    }
  }

  const parameters = await searchParams;
  const message = state.configured
    ? errorMessage(parameters.error)
    : errorMessage("Configuration");

  return (
    <div className="flex min-h-screen flex-col bg-paper dark:bg-[#07131f]">
      <a
        href="#sign-in-main"
        className="fixed left-3 top-3 z-[60] -translate-y-20 bg-signal px-3 py-2 text-xs font-semibold text-[#07131f] outline-none focus:translate-y-0 focus:ring-2 focus:ring-white"
      >
        Liigu sisselogimise juurde
      </a>

      <header className="border-b border-[#172b3b] bg-[#08131f] text-[#e8f0f6] shadow-[0_1px_0_#4f8cff]">
        <div className="mx-auto flex min-h-12 max-w-[96rem] items-center justify-between gap-4 px-3 sm:px-5 lg:px-7">
          <a
            href="/"
            className="flex items-center gap-2.5 outline-none focus-visible:ring-1 focus-visible:ring-signal"
            aria-label="117.ee avaleht"
          >
            <span className="block size-10 shrink-0" aria-hidden="true">
              <img src="/117.png" alt="" className="size-full object-contain" />
            </span>
            <span className="text-[13px] font-medium text-[#8da1b0]">Privaatne töölaud</span>
          </a>
          <SignInThemeToggle />
        </div>
      </header>

      <main
        id="sign-in-main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-[70rem] flex-1 items-center px-3 py-12 outline-none sm:px-5 lg:px-7"
      >
        <section className="grid w-full border border-[#aebcc6] bg-white shadow-[4px_4px_0_#c8d4dc] md:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)] dark:border-[#29485f] dark:bg-[#0b1b29] dark:shadow-[4px_4px_0_#102538]">
          <div className="border-b border-[#c5d0d7] p-6 sm:p-8 md:border-b-0 md:border-r dark:border-[#263d50]">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#245fae] dark:text-signal">
              117.ee · Ajakava
            </p>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[#526878] dark:text-[#9bb0bf]">
              Ajakava on töölaua privaatne osa. Jätkamiseks logi sisse lubatud GitHubi kontoga või ava enne saadud kutselink.
            </p>
            <div className="mt-7 grid gap-px border border-[#c5d0d7] bg-[#c5d0d7] text-xs dark:border-[#263d50] dark:bg-[#263d50] sm:grid-cols-3">
              {["Krüptitud seanss", "Kutsepõhised kontod", "Valitav püsi-login"].map((label) => (
                <span key={label} className="bg-[#f6f8f9] px-3 py-2 font-semibold text-[#526878] dark:bg-[#0d2030] dark:text-[#8da1b0]">
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-center p-6 sm:p-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#617786] dark:text-[#7890a2]">
              Turvaline sisselogimine
            </p>
            {message && (
              <p role="alert" className="mt-3 border border-[#9d762f] bg-[#f7ead2] px-3 py-2 text-xs font-semibold text-[#67460f] dark:border-[#9d762f] dark:bg-[#2b2417] dark:text-[#efc983]">
                {message}
              </p>
            )}
            <GithubSignInForm
              configured={state.configured}
              onStandardSignIn={beginGithubSignIn}
              onInvitedSignIn={beginInvitedGithubSignIn}
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-[#b7c4cc] px-3 py-4 text-center text-[11px] text-[#617786] dark:border-[#20394d] dark:text-[#7890a2]">
        <b className="text-[#245fae] dark:text-signal">117.ee</b> · Privaatne ajakava
      </footer>
    </div>
  );
}
