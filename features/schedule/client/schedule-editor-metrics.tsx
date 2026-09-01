"use client";

import type { WeeklyMetric } from "@/lib/schedule-types";

import { EditorEmpty, NumberField, TextAreaField, TextField } from "./schedule-editor-fields";
import { moveItem, newWeeklyMetric, removeItem, replaceItem } from "./schedule-editor-helpers";
import { EditorItem, EditorSectionHeader } from "./schedule-editor-section";

export function ScheduleMetricsEditor({
  metrics,
  onChange,
}: {
  metrics: WeeklyMetric[];
  onChange: (metrics: WeeklyMetric[]) => void;
}) {
  const update = (index: number, next: WeeklyMetric) => onChange(replaceItem(metrics, index, next));

  return (
    <section>
      <EditorSectionHeader
        eyebrow="Tasakaal · 2"
        title="Nädala tasakaal"
        description="Määra, mitu tundi nädalas iga eluosa ligikaudu võtab. Protsendid arvutatakse vaates automaatselt."
        count={metrics.length}
        addLabel="Lisa mõõdik"
        onAdd={() => onChange([...metrics, newWeeklyMetric(metrics)])}
      />

      {metrics.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {metrics.map((metric, index) => (
            <EditorItem
              key={metric.id}
              number={index + 1}
              title={metric.label}
              onMoveUp={index > 0 ? () => onChange(moveItem(metrics, index, -1)) : undefined}
              onMoveDown={index < metrics.length - 1 ? () => onChange(moveItem(metrics, index, 1)) : undefined}
              onDelete={() => onChange(removeItem(metrics, index))}
            >
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
                <TextField label="Nimetus" value={metric.label} onChange={(label) => update(index, { ...metric, label })} />
                <NumberField label="Tundi nädalas" value={metric.hours} minimum={0} maximum={168} onChange={(hours) => update(index, { ...metric, hours: hours ?? 0 })} />
              </div>
              <TextAreaField label="Selgitus" value={metric.detail} placeholder="Mida see mõõdik sisaldab?" onChange={(detail) => update(index, { ...metric, detail })} />
            </EditorItem>
          ))}
        </div>
      ) : <EditorEmpty>Tasakaalu mõõdikuid pole. Lisa ainult need, mida soovid jälgida.</EditorEmpty>}
    </section>
  );
}
