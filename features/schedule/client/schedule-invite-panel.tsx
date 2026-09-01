"use client";

import { useState } from "react";

export type CreateScheduleInviteResult =
  | Readonly<{ ok: true; id: string; token: string; expiresAt: string }>
  | Readonly<{ ok: false; error: "forbidden" | "unavailable" }>;

export type ScheduleInviteItem = Readonly<{
  id: string;
  expiresAt: string;
  status: "available" | "claimed" | "expired" | "revoked";
}>;

type ScheduleInvitePanelProps = {
  initialInvites: readonly ScheduleInviteItem[];
  onCreateInvite: () => Promise<CreateScheduleInviteResult>;
  onRevokeInvite: (inviteId: string) => Promise<boolean>;
};

const expiryFormatter = new Intl.DateTimeFormat("et-EE", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Tallinn",
});

export function ScheduleInvitePanel({
  initialInvites,
  onCreateInvite,
  onRevokeInvite,
}: ScheduleInvitePanelProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [message, setMessage] = useState("");
  const [invites, setInvites] = useState(initialInvites);
  const [revokingId, setRevokingId] = useState("");
  const availableInvites = invites.filter((invite) => invite.status === "available");

  async function createInvite() {
    if (creating) return;
    setCreating(true);
    setMessage("");
    try {
      const result = await onCreateInvite();
      if (!result.ok) {
        setMessage(result.error === "forbidden"
          ? "Ainult ajakava omanik saab kutseid luua."
          : "Kutse loomine ei õnnestunud. Proovi uuesti.");
        return;
      }
      const url = new URL("/sisene", window.location.origin);
      url.hash = new URLSearchParams({ invite: result.token }).toString();
      const nextInviteLink = url.toString();
      setInviteLink(nextInviteLink);
      setExpiresAt(result.expiresAt);
      setInvites((current) => [
        { id: result.id, expiresAt: result.expiresAt, status: "available" },
        ...current,
      ]);
      try {
        await navigator.clipboard.writeText(nextInviteLink);
        setMessage("Kutse on valmis ja link kopeeritud.");
      } catch {
        setMessage("Kutse on valmis. Kopeeri allolev link käsitsi.");
      }
    } catch {
      setMessage("Kutse loomine ei õnnestunud. Proovi uuesti.");
    } finally {
      setCreating(false);
    }
  }

  async function revokeInvite(inviteId: string) {
    if (revokingId) return;
    setRevokingId(inviteId);
    setMessage("");
    try {
      if (!await onRevokeInvite(inviteId)) {
        setMessage("Kutse tühistamine ei õnnestunud. Värskenda lehte ja proovi uuesti.");
        return;
      }
      setInvites((current) => current.map((invite) => invite.id === inviteId
        ? { ...invite, status: "revoked" }
        : invite));
      setInviteLink("");
      setExpiresAt("");
      setMessage("Kutse on tühistatud.");
    } catch {
      setMessage("Kutse tühistamine ei õnnestunud. Proovi uuesti.");
    } finally {
      setRevokingId("");
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setMessage("Kutse link on kopeeritud.");
    } catch {
      setMessage("Vali link ja kopeeri see käsitsi.");
    }
  }

  function closePanel() {
    setOpen(false);
    setInviteLink("");
    setExpiresAt("");
    setMessage("");
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-10 border border-[#9fb2c0] bg-white px-3 text-[11px] font-black text-[#174b8d] outline-none hover:bg-[#edf3f7] focus-visible:ring-2 focus-visible:ring-signal dark:border-[#35536a] dark:bg-[#0b1b29] dark:text-signal dark:hover:bg-[#102538]"
      >
        Kutsu sõber{availableInvites.length ? ` · ${availableInvites.length}` : ""}
      </button>
    );
  }

  return (
    <section className="border border-[#9fb2c0] bg-[#eef5f7] p-3 dark:border-[#35536a] dark:bg-[#0d2030]" aria-labelledby="schedule-invite-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#245fae] dark:text-signal">Ühekordne kutse</p>
          <h2 id="schedule-invite-title" className="mt-1 text-sm font-black text-[#172634] dark:text-[#edf4f8]">Lisa ajakava kasutaja</h2>
          <p className="mt-1 max-w-xl text-[11px] leading-5 text-[#617786] dark:text-[#8da1b0]">Sõber avab lingi ja logib GitHubiga sisse. Tema saab praegusest mallist täiesti eraldi ajakava.</p>
        </div>
        <button type="button" onClick={closePanel} className="min-h-9 shrink-0 px-2 text-[11px] font-black text-[#526878] outline-none hover:text-[#174b8d] focus-visible:ring-2 focus-visible:ring-signal dark:text-[#9bb0bf] dark:hover:text-white">Sulge</button>
      </div>

      {inviteLink ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="min-w-0 text-[10px] font-black uppercase tracking-[0.07em] text-[#526878] dark:text-[#9bb0bf]">
            Kutse link
            <input
              readOnly
              value={inviteLink}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-1 min-h-11 w-full border border-[#aebcc6] bg-white px-3 text-xs normal-case tracking-normal text-[#172634] outline-none focus-visible:ring-2 focus-visible:ring-signal dark:border-[#35536a] dark:bg-[#07131f] dark:text-[#edf4f8]"
            />
          </label>
          <button type="button" onClick={copyInvite} className="min-h-11 self-end border border-[#245fae] bg-[#245fae] px-4 text-xs font-black text-white outline-none hover:bg-[#174b8d] focus-visible:ring-2 focus-visible:ring-signal dark:border-signal dark:bg-signal dark:text-[#07131f]">Kopeeri link</button>
          {expiresAt && <p className="text-[10px] text-[#617786] dark:text-[#8da1b0] sm:col-span-2">Kehtib kuni {expiryFormatter.format(new Date(expiresAt))}.</p>}
        </div>
      ) : (
        <button
          type="button"
          disabled={creating}
          onClick={createInvite}
          className="mt-3 min-h-11 border border-[#245fae] bg-[#245fae] px-4 text-xs font-black text-white outline-none hover:bg-[#174b8d] focus-visible:ring-2 focus-visible:ring-signal disabled:cursor-not-allowed disabled:opacity-50 dark:border-signal dark:bg-signal dark:text-[#07131f]"
        >
          {creating ? "Loon kutset…" : "Loo ja kopeeri kutse"}
        </button>
      )}

      {availableInvites.length > 0 && (
        <details className="mt-4 border-t border-[#bdc9d1] pt-3 dark:border-[#35536a]">
          <summary className="min-h-9 cursor-pointer text-[10px] font-black uppercase tracking-[0.08em] text-[#526878] outline-none focus-visible:ring-2 focus-visible:ring-signal dark:text-[#9bb0bf]">
            Aktiivsed kutsed · {availableInvites.length}
          </summary>
          <div className="mt-2 grid gap-2">
            {availableInvites.map((invite) => (
              <div key={invite.id} className="flex flex-col gap-2 border border-[#bdc9d1] bg-white px-3 py-2 dark:border-[#35536a] dark:bg-[#07131f] sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[10px] text-[#617786] dark:text-[#8da1b0]">
                  Kehtib kuni {expiryFormatter.format(new Date(invite.expiresAt))}
                </p>
                <button
                  type="button"
                  disabled={Boolean(revokingId)}
                  onClick={() => revokeInvite(invite.id)}
                  className="min-h-9 border border-[#9f3030] px-3 text-[10px] font-black text-[#9f3030] outline-none hover:bg-[#f8e3e3] focus-visible:ring-2 focus-visible:ring-signal disabled:opacity-50 dark:text-[#f2a3a3] dark:hover:bg-[#2d1717]"
                >
                  {revokingId === invite.id ? "Tühistan…" : "Tühista kutse"}
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
      {message && <p className="mt-2 text-[11px] font-bold text-[#526878] dark:text-[#b8c9d4]" aria-live="polite">{message}</p>}
    </section>
  );
}
