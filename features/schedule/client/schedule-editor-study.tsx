"use client";

import type { StudyPlan } from "@/lib/schedule-types";

import {
  DaySelect,
  EditorEmpty,
  NumberField,
  TextAreaField,
  TextField,
} from "./schedule-editor-fields";
import { moveItem, newStudyPlan, removeItem, replaceItem } from "./schedule-editor-helpers";
import { EditorItem, EditorSectionHeader } from "./schedule-editor-section";

export function ScheduleStudyEditor({
  plans,
  onChange,
}: {
  plans: StudyPlan[];
  onChange: (plans: StudyPlan[]) => void;
}) {
  const update = (index: number, next: StudyPlan) => onChange(replaceItem(plans, index, next));

  return (
    <section>
      <EditorSectionHeader
        eyebrow="Tasakaal · 1"
        title="Õppekoormus"
        description="Õppimise siht, võimalik tulemus ja seis. Tegelik aeg võib jääda tühjaks."
        count={plans.length}
        addLabel="Lisa õppimiskirje"
        onAdd={() => onChange([...plans, newStudyPlan(plans)])}
      />

      {plans.length ? (
        <div className="grid gap-4">
          {plans.map((plan, index) => (
            <EditorItem
              key={plan.id}
              number={index + 1}
              title={plan.focus || `${plan.day}. päeva õppimine`}
              onMoveUp={index > 0 ? () => onChange(moveItem(plans, index, -1)) : undefined}
              onMoveDown={index < plans.length - 1 ? () => onChange(moveItem(plans, index, 1)) : undefined}
              onDelete={() => onChange(removeItem(plans, index))}
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <DaySelect value={plan.day} onChange={(day) => update(index, { ...plan, day })} />
                <TextField label="Ajavahemik" value={plan.window} placeholder="nt 17:00–19:00" onChange={(window) => update(index, { ...plan, window })} />
                <NumberField label="Maksimumtunnid" value={plan.maxHours} minimum={0} maximum={24} onChange={(maxHours) => update(index, { ...plan, maxHours: maxHours ?? 0 })} />
                <NumberField label="Tegelikud tunnid" value={plan.actualHours} minimum={0} maximum={24} nullable onChange={(actualHours) => update(index, { ...plan, actualHours })} />
              </div>
              <TextAreaField label="Fookus" value={plan.focus} placeholder="Mida selle aja sees teha?" onChange={(focus) => update(index, { ...plan, focus })} />
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="Raskus" value={plan.difficulty} placeholder="nt Keskmine" maxLength={80} onChange={(difficulty) => update(index, { ...plan, difficulty })} />
                <TextField label="Seis" value={plan.status} placeholder="nt Planeeritud" maxLength={80} onChange={(status) => update(index, { ...plan, status })} />
              </div>
            </EditorItem>
          ))}
        </div>
      ) : <EditorEmpty>Õppimiskirjeid pole. See osa võib soovi korral ka tühjaks jääda.</EditorEmpty>}
    </section>
  );
}
