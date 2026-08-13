import type { RiigikoguAgenda, RiigikoguAgendaItem } from "@/lib/riigikogu-types";
import {
  array,
  classifierLabel,
  cleanTitle,
  dateOnly,
  integer,
  record,
  sourceLink,
  tallinnDateTime,
  uuid,
} from "./riigikogu-parser.ts";

function parseAgendaItem(value: unknown): RiigikoguAgendaItem {
  const item = record(value, "agenda item");
  const draft = item.relatedDraft ? record(item.relatedDraft, "related draft") : null;
  return {
    id: uuid(item.uuid, "agenda item UUID"),
    order: integer(item.order, "agenda item order"),
    title: cleanTitle(item.title, "agenda item title"),
    type: classifierLabel(item.type),
    stage: typeof item.stage === "string" ? item.stage : null,
    decision: classifierLabel(item.decision),
    draft: draft ? {
      id: uuid(draft.uuid, "agenda draft UUID"),
      mark: Number.isSafeInteger(draft.mark) ? Number(draft.mark) : null,
      title: cleanTitle(draft.title, "agenda draft title"),
      sourceUrl: sourceLink(draft._links) ?? `https://api.riigikogu.ee/api/volumes/drafts/${uuid(draft.uuid, "agenda draft UUID")}`,
    } : null,
  };
}

export function parseRiigikoguAgenda(value: unknown): RiigikoguAgenda {
  const agenda = record(value, "agenda");
  const weekStart = dateOnly(agenda.weekStartDate);
  const weekEnd = dateOnly(agenda.weekEndDate);
  if (!weekStart || !weekEnd) throw new TypeError("Riigikogu agenda dates are invalid");
  return {
    weekStart,
    weekEnd,
    title: typeof agenda.title === "string" && agenda.title.trim() ? agenda.title.trim() : null,
    sittings: array(agenda.sittings).map((value) => {
      const sitting = record(value, "sitting");
      return {
        id: uuid(sitting.uuid, "sitting UUID"),
        title: cleanTitle(sitting.title, "sitting title"),
        startsAt: tallinnDateTime(sitting.sittingDateTime, "sitting date-time"),
        items: array(sitting.agendaItems).map(parseAgendaItem).sort((left, right) => left.order - right.order),
      };
    }).sort((left, right) => left.startsAt.localeCompare(right.startsAt)),
  };
}
