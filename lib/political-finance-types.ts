export type PoliticalFinancePeriod = `${number}-Q${1 | 2 | 3 | 4}`;

export type PoliticalFinanceSource = {
  id: "erjk";
  name: string;
  pageUrl: string;
  apiDocumentationUrl: string;
  licence: "CC BY-SA 3.0";
  licenceUrl: string;
  status: "ok" | "partial" | "stale";
  statusMessage: string | null;
  retrievedAt: string;
  publishedAt: null;
};

export type PoliticalFinanceCategoryTotal = {
  id: string;
  name: string;
  amount: number;
  sharePct: number;
};

export type PoliticalFinanceHistoryPoint = {
  period: PoliticalFinancePeriod;
  income: number | null;
  expenses: number | null;
  donations: number | null;
};

export type PoliticalFinanceDonation = {
  id: string;
  donorName: string;
  amount: number;
  date: string | null;
  category: string;
};

export type PoliticalFinanceDonor = {
  id: string;
  donorName: string;
  amount: number;
  donationCount: number;
  /** True when the same published name identifies multiple source counterparties. */
  ambiguousIdentity: boolean;
};

export type PoliticalFinanceFilingReference = {
  id: string;
  revisionId: string;
  period: PoliticalFinancePeriod;
  sourceReportId: number | null;
  sourceUrl: string;
};

export type PoliticalFinancePartySummary = {
  id: string;
  canonicalPartyId: string | null;
  sourcePartyId: string;
  name: string;
  shortName: string;
  sourceName: string;
  color: string;
  filing: PoliticalFinanceFilingReference;
  income: number | null;
  expenses: number | null;
  donations: number | null;
  donationSharePct: number | null;
  donorConcentrationTop5Pct: number | null;
  detailReconciles: boolean | null;
  incomeCategories: PoliticalFinanceCategoryTotal[];
  largestDonations: PoliticalFinanceDonation[];
  largestDonors: PoliticalFinanceDonor[];
  history: PoliticalFinanceHistoryPoint[];
};

export type PoliticalFinanceResponse = {
  period: PoliticalFinancePeriod;
  availablePeriods: PoliticalFinancePeriod[];
  parties: PoliticalFinancePartySummary[];
  source: PoliticalFinanceSource;
  retrievedAt: string;
};

export type PoliticalFinanceRecordType = "donations" | "income" | "expenses";

export type PoliticalFinanceRecord = {
  id: string;
  filingId: string;
  partyId: string;
  sourcePartyId: string;
  period: PoliticalFinancePeriod;
  type: "donation" | "income" | "expense";
  categoryId: string;
  categoryName: string;
  reportedName: string | null;
  date: string | null;
  amount: number;
  sourceReportId: number;
  sourceUrl: string;
};

export type PoliticalFinanceRecordsResponse = {
  party: {
    id: string;
    sourcePartyId: string;
    name: string;
    sourceName: string;
  };
  filing: PoliticalFinanceFilingReference;
  recordType: PoliticalFinanceRecordType;
  category: string | null;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  availableCategories: Array<{ id: string; name: string; count: number }>;
  records: PoliticalFinanceRecord[];
  source: PoliticalFinanceSource;
};

export type PoliticalFinanceUnavailableResponse = {
  error: string;
};
