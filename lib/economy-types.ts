export const ECONOMY_GROUP_IDS = [
  "prices",
  "income",
  "work",
  "output",
  "trade",
  "region",
] as const;

export type EconomyGroupId = (typeof ECONOMY_GROUP_IDS)[number];
export type EconomyFrequency = "monthly" | "quarterly";
export type EconomyGroupStatus = "ok" | "stale" | "failed";
export type EconomyOverallStatus = "ok" | "partial" | "failed";
export type EconomyOutlook = "improved" | "worsened" | "neutral" | "unavailable";
export type EconomyReleaseStatus = "published" | "provisional" | "forecast";
export type EconomyComparisonKind = "percent" | "percentage-point" | "absolute";

export type EconomyPeriod = {
  id: string;
  label: string;
  frequency: EconomyFrequency;
};

export type EconomyObservation = {
  period: EconomyPeriod;
  value: number;
  releaseStatus: EconomyReleaseStatus;
  revision: "not-detectable" | "revised-in-response";
};

export type EconomyComparison = {
  kind: EconomyComparisonKind;
  value: number;
  referencePeriod: EconomyPeriod;
};

export type EconomyUnit = {
  id: "percent" | "euro" | "million-euro" | "index";
  label: string;
  symbol: string;
  decimals: number;
};

export type EconomySourceReference = {
  providerId: "statistics-estonia";
  providerName: "Statistikaamet";
  tableId: string;
  tableTitle: string;
  tableUrl: string;
  apiUrl: string;
  updatedAt: string | null;
  retrievedAt: string;
  attribution: "Statistikaamet";
  licenceName: "CC BY-SA 4.0";
  licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/";
  revisionPolicy: "latest-source-value";
};

export type EconomyClassification = {
  outlook: EconomyOutlook;
  basis: string;
  explanation: string;
};

export type EconomyDerivation = {
  formula: string;
  inputPeriods: string[];
};

export type EconomyBenchmark = {
  geographyCode: string;
  geographyLabel: string;
  period: EconomyPeriod;
  value: number;
  differencePercent: number;
};

export type EconomyIndicator = {
  id: string;
  groupId: EconomyGroupId;
  label: string;
  description: string;
  availability: "available" | "not-available";
  frequency: EconomyFrequency;
  geographyCode: string;
  geographyLabel: string;
  unit: EconomyUnit;
  priceBasis: "not-applicable" | "nominal" | "chain-linked-2020" | "index-1997";
  seasonalAdjustment: "not-applicable" | "unadjusted" | "seasonally-adjusted";
  current: EconomyObservation | null;
  previousPeriod: EconomyComparison | null;
  yearOverYear: EconomyComparison | null;
  history: EconomyObservation[];
  benchmark?: EconomyBenchmark;
  classification: EconomyClassification;
  derivation?: EconomyDerivation;
  source: EconomySourceReference;
};

export type EconomyGroup = {
  id: EconomyGroupId;
  label: string;
  description: string;
  status: EconomyGroupStatus;
  indicators: EconomyIndicator[];
  source: EconomySourceReference;
  message: string | null;
};

export type EconomySummary = {
  improved: number;
  worsened: number;
  neutral: number;
  unavailable: number;
  considered: number;
  methodology: string;
};

export type EconomySourceStatus = {
  id: "statistics-estonia";
  name: "Statistikaamet";
  status: EconomyOverallStatus;
  successfulGroups: number;
  totalGroups: number;
  oldestRetrievedAt: string | null;
};

export type EconomyResponse = {
  version: 1;
  generatedAt: string;
  status: EconomyOverallStatus;
  summary: EconomySummary;
  groups: EconomyGroup[];
  sources: EconomySourceStatus[];
};

export type EconomyUnavailableResponse = {
  error: string;
};
