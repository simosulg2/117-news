"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { validateScheduleData } from "@/features/schedule/model/schedule-validation";
import type { ScheduleData } from "@/lib/schedule-types";

import { ScheduleEventsEditor } from "./schedule-editor-events";
import { ScheduleGeneralEditor } from "./schedule-editor-general";
import {
  copyScheduleData,
  sectionForValidationPath,
  type ScheduleEditorSection,
} from "./schedule-editor-helpers";
import { ScheduleMetricsEditor } from "./schedule-editor-metrics";
import { ScheduleEditorNavigation } from "./schedule-editor-navigation";
import { ScheduleRoutinesEditor } from "./schedule-editor-routines";
import { ScheduleSchoolEditor } from "./schedule-editor-school";
import { ScheduleStudyEditor } from "./schedule-editor-study";

export type ScheduleEditorProps = {
  data: ScheduleData;
  onSave: (data: ScheduleData) => Promise<void>;
  onClose: () => void;
};

type SaveStatus = "idle" | "saving" | "success" | "error";

function ActiveEditor({
  section,
  data,
  onChange,
}: {
  section: ScheduleEditorSection;
  data: ScheduleData;
  onChange: (data: ScheduleData) => void;
}) {
  switch (section) {
    case "general": return <ScheduleGeneralEditor data={data} onChange={onChange} />;
    case "events": return <ScheduleEventsEditor events={data.events} onChange={(events) => onChange({ ...data, events })} />;
    case "school": return <ScheduleSchoolEditor periods={data.schoolPeriods} onChange={(schoolPeriods) => onChange({ ...data, schoolPeriods })} />;
    case "routines": return <ScheduleRoutinesEditor routines={data.routines} onChange={(routines) => onChange({ ...data, routines })} />;
    case "balance": return (
      <div className="grid gap-9">
        <ScheduleStudyEditor plans={data.studyPlans} onChange={(studyPlans) => onChange({ ...data, studyPlans })} />
        <ScheduleMetricsEditor metrics={data.metrics} onChange={(metrics) => onChange({ ...data, metrics })} />
      </div>
    );
  }
}

export function ScheduleEditor({ data, onSave, onClose }: ScheduleEditorProps) {
  const incomingSerialized = useMemo(() => JSON.stringify(data), [data]);
  const previousIncoming = useRef(incomingSerialized);
  const [draft, setDraft] = useState(() => copyScheduleData(data));
  const [baseline, setBaseline] = useState(incomingSerialized);
  const [activeSection, setActiveSection] = useState<ScheduleEditorSection>("general");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const dirty = useMemo(() => JSON.stringify(draft) !== baseline, [draft, baseline]);

  useEffect(() => {
    if (previousIncoming.current === incomingSerialized) return;
    previousIncoming.current = incomingSerialized;
    setDraft(copyScheduleData(data));
    setBaseline(incomingSerialized);
    setConfirmClose(false);
  }, [data, incomingSerialized]);

  const updateDraft = (next: ScheduleData) => {
    setDraft(next);
    setStatus("idle");
    setMessage("");
    setConfirmClose(false);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "saving" || !dirty) return;
    const validation = validateScheduleData(draft);
    if (!validation.ok) {
      setActiveSection(sectionForValidationPath(validation.issues[0]?.path ?? "$"));
      setStatus("error");
      setMessage("Mõni väli on tühi või lubatud piiridest väljas. Kontrolli avatud osa ja proovi uuesti.");
      return;
    }

    setStatus("saving");
    setMessage("Salvestan muudatusi…");
    try {
      await onSave(validation.data);
      const saved = copyScheduleData(validation.data);
      setDraft(saved);
      setBaseline(JSON.stringify(saved));
      setStatus("success");
      setMessage("Muudatused on salvestatud.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error && error.message
        ? error.message
        : "Salvestamine ebaõnnestus. Sinu muudatused on alles — proovi uuesti.");
    }
  };

  const requestClose = () => {
    if (dirty) {
      setConfirmClose(true);
      return;
    }
    onClose();
  };

  const secondaryButton = "min-h-11 border border-[#9fb2c0] bg-white px-4 text-xs font-black text-[#526878] outline-none hover:bg-[#edf3f7] focus-visible:ring-2 focus-visible:ring-signal disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#35536a] dark:bg-[#0b1b29] dark:text-[#d5e0e7] dark:hover:bg-[#102538]";

  return (
    <form onSubmit={save} className="border border-[#aebcc6] bg-[#f8fafb] shadow-[4px_4px_0_#c8d4dc] dark:border-[#29485f] dark:bg-[#091925] dark:shadow-[4px_4px_0_#102538]" aria-label="Ajakava muutmine">
      <header className="border-b border-[#aebcc6] bg-white px-3 py-4 dark:border-[#29485f] dark:bg-[#0b1b29] sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#245fae] dark:text-signal">Privaatne redaktor</p>
              <span className={`border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.07em] ${dirty
                ? "border-[#b36b24] bg-[#f7ead2] text-[#795516] dark:bg-[#2b2417] dark:text-[#efc983]"
                : "border-[#8db6aa] bg-[#e2f1ec] text-[#256856] dark:bg-[#123126] dark:text-[#8ed2be]"
              }`}>{dirty ? "Salvestamata" : "Salvestatud"}</span>
            </div>
            <h2 className="mt-1 text-xl font-black text-[#172634] dark:text-[#edf4f8] sm:text-2xl">Muuda ajakava</h2>
            <p className="mt-1 text-xs leading-5 text-[#617786] dark:text-[#8da1b0]">Muudatused jõustuvad alles pärast salvestamist. Iga kasutaja ajakava on eraldi.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryButton} disabled={status === "saving"} onClick={requestClose}>Sulge</button>
            <button type="submit" disabled={!dirty || status === "saving"} className="min-h-11 border border-[#245fae] bg-[#245fae] px-5 text-xs font-black text-white outline-none hover:bg-[#174b8d] focus-visible:ring-2 focus-visible:ring-signal disabled:cursor-not-allowed disabled:opacity-45 dark:border-signal dark:bg-signal dark:text-[#07131f] dark:hover:bg-[#91dfef]">
              {status === "saving" ? "Salvestan…" : "Salvesta muudatused"}
            </button>
          </div>
        </div>

        <div className="mt-3 min-h-5 text-xs" aria-live="polite" aria-atomic="true">
          {message && <p className={status === "error" ? "font-bold text-[#9f3030] dark:text-[#f2a3a3]" : status === "success" ? "font-bold text-[#256856] dark:text-[#8ed2be]" : "text-[#617786] dark:text-[#9bb0bf]"}>{message}</p>}
        </div>

        {confirmClose && (
          <div className="mt-3 flex flex-col gap-3 border border-[#c7aa72] bg-[#f7ead2] p-3 text-[#67460f] dark:border-[#72582c] dark:bg-[#2b2417] dark:text-[#efc983] sm:flex-row sm:items-center sm:justify-between" role="alert">
            <p className="text-xs font-bold">Sul on salvestamata muudatusi. Kas soovid neist loobuda?</p>
            <div className="flex gap-2">
              <button type="button" className={secondaryButton} onClick={() => setConfirmClose(false)}>Jätka muutmist</button>
              <button type="button" className="min-h-11 border border-[#9f3030] bg-[#9f3030] px-4 text-xs font-black text-white outline-none focus-visible:ring-2 focus-visible:ring-signal" onClick={onClose}>Loobu muudatustest</button>
            </div>
          </div>
        )}
      </header>

      <fieldset disabled={status === "saving"} className="min-w-0">
        <legend className="sr-only">Ajakava muudetavad osad</legend>
        <ScheduleEditorNavigation activeSection={activeSection} data={draft} onChange={setActiveSection} />

        <div
          id="schedule-editor-panel"
          role="tabpanel"
          tabIndex={0}
          aria-labelledby={`schedule-editor-tab-${activeSection}`}
          className="p-3 sm:p-5"
        >
          <ActiveEditor section={activeSection} data={draft} onChange={updateDraft} />
        </div>
      </fieldset>
    </form>
  );
}
