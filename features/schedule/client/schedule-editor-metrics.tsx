"use client";

import type { WeeklyMetric } from "@/lib/schedule-types";

import { EditorEmpty, NumberField, TextAreaField, TextField } from "./schedule-editor-fields";
import { moveItem, newWeeklyMetric, removeItem, replaceItem } from "./schedule-editor-helpers";
import { CompactEditorItem, EditorSectionHeader } from "./schedule-editor-section";

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
        eyebrow="Tasakaal · valikuline"
        title="Nädala jaotus"
        description="Lisa ainult need eluosad, mille tundide jaotust tahad vaates näha."
        count={metrics.length}
        addLabel="Lisa eluosa"
        onAdd={() => onChange([newWeeklyMetric(metrics), ...metrics])}
      />

      {metrics.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {metrics.map((metric, index) => (
            <CompactEditorItem
              key={metric.id}
              number={index + 1}
              title={metric.label}
              summary={`${metric.hours} tundi nädalas`}
              onMoveUp={index > 0 ? () => onChange(moveItem(metrics, index, -1)) : undefined}
              onMoveDown={index < metrics.length - 1 ? () => onChange(moveItem(metrics, index, 1)) : undefined}
              onDelete={() => onChange(removeItem(metrics, index))}
              more={<TextAreaField label="Selgitus" value={metric.detail} placeholder="Valikuline täpsustus" onChange={(detail) => update(index, { ...metric, detail })} />}
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
                <TextField label="Eluosa" value={metric.label} onChange={(label) => update(index, { ...metric, label })} />
                <NumberField label="Tundi nädalas" value={metric.hours} minimum={0} maximum={168} onChange={(hours) => update(index, { ...metric, hours: hours ?? 0 })} />
              </div>
            </CompactEditorItem>
          ))}
        </div>
      ) : <EditorEmpty>Nädala jaotust pole. Seda osa ei pea kasutama.</EditorEmpty>}
    </section>
  );
}
