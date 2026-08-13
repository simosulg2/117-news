import type { RiigikoguBillDetail, RiigikoguBillSummary } from "@/lib/riigikogu-types";
import {
  array,
  cleanTitle,
  dateOnly,
  namedSourceLink,
  optionalInteger,
  optionalString,
  record,
  sourceLink,
  tallinnDateTime,
  uuid,
} from "./riigikogu-parser.ts";

export function parseBillSummary(value: unknown): RiigikoguBillSummary {
  const bill = record(value, "bill");
  const id = uuid(bill.uuid, "bill UUID");
  const committee = bill.leadingCommittee ? record(bill.leadingCommittee, "leading committee") : null;
  return {
    id,
    mark: optionalInteger(bill.mark),
    title: cleanTitle(bill.title, "bill title"),
    typeCode: optionalString(bill.draftTypeCode),
    stageCode: optionalString(bill.activeDraftStage),
    statusCode: optionalString(bill.activeDraftStatus),
    statusDate: dateOnly(bill.activeDraftStatusDate),
    initiatedAt: dateOnly(bill.initiated),
    leadingCommittee: committee ? optionalString(committee.name) : null,
    sourceUrl: sourceLink(bill._links) ?? `https://api.riigikogu.ee/api/volumes/drafts/${id}`,
  };
}

export function parseBillList(value: unknown): RiigikoguBillSummary[] {
  const page = record(value, "bill page");
  const embedded = record(page._embedded, "bill page content");
  return array(embedded.content).map(parseBillSummary)
    .sort((left, right) => (right.statusDate ?? right.initiatedAt ?? "").localeCompare(left.statusDate ?? left.initiatedAt ?? ""));
}

export function parseBillDetail(value: unknown, retrievedAt: string): RiigikoguBillDetail {
  const raw = record(value, "bill detail");
  const summary = parseBillSummary(raw);
  const events = array(raw.readings).flatMap((readingValue) => {
    const reading = record(readingValue, "bill reading");
    const readingCode = optionalString(reading.readingCode) ?? "UNKNOWN";
    return array(reading.proceedingEvents).map((eventValue) => {
      const event = record(eventValue, "bill event");
      return {
        readingCode,
        happenedAt: tallinnDateTime(event.date, "bill event date"),
        sourceUrl: sourceLink(event._links),
      };
    });
  }).sort((left, right) => right.happenedAt.localeCompare(left.happenedAt));
  const documents = array(raw.texts).flatMap((textValue) => {
    const text = record(textValue, "bill text");
    if (!text.file) return [];
    const file = record(text.file, "bill file");
    const sourceUrl = namedSourceLink(file._links, "download");
    if (!sourceUrl) return [];
    return [{
      title: optionalString(file.fileTitle) ?? optionalString(file.fileName) ?? "Dokument",
      sourceUrl,
    }];
  });
  return {
    ...summary,
    initialTitle: optionalString(raw.initialTitle),
    initiators: array(raw.initiators).flatMap((value) => {
      const name = optionalString(record(value, "bill initiator").name);
      return name ? [name] : [];
    }),
    amendmentsDeadline: raw.amendmentsDeadline ? tallinnDateTime(raw.amendmentsDeadline, "amendments deadline") : null,
    acceptedAt: dateOnly(raw.accepted),
    events,
    documents,
    attribution: attribution(retrievedAt),
  };
}

function attribution(retrievedAt: string): RiigikoguBillDetail["attribution"] {
  return {
    name: "Riigikogu Kantselei avaandmed",
    sourceUrl: "https://www.riigikogu.ee/avaandmed/",
    licence: "CC BY-SA 3.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    retrievedAt,
  };
}
