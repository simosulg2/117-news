export type RatingsPartyKind = "party" | "independent" | "other";

export type RatingsParty = {
  /** Stable application ID. Known parties keep this ID if their source label changes. */
  id: string;
  /** Full name intended for visible attribution and accessible labels. */
  name: string;
  /** Compact label intended for legends and narrow screens. */
  shortName: string;
  /** Unmodified party label from the source dataset. */
  sourceName: string;
  /** UI color assigned by the application, not supplied by Norstat. */
  color: string;
  kind: RatingsPartyKind;
  /** Support among respondents who expressed a party preference. */
  supportPct: number | null;
  /** Support in the immediately preceding rolling four-week wave. */
  previousSupportPct: number | null;
  /** Current minus previous support, in percentage points. */
  changePctPoints: number | null;
};

export type RatingsWave = {
  id: string;
  kind: "rolling-four-week";
  startDate: string;
  endDate: string;
};

export type RatingsSample = {
  total: number | null;
  voters: number | null;
  effectiveTotal: number | null;
  effectiveVoters: number | null;
};

export type RatingsSource = {
  id: "norstat-yui";
  label: "Ühiskonnauuringute Instituut / Norstat";
  pollster: "Norstat Eesti AS";
  commissioner: "MTÜ Ühiskonnauuringute Instituut";
  dataUrl: string;
  documentationUrl: string;
  methodologyUrl: string;
  publisherUrl: string;
  /** The publisher documents public access but does not state a reuse licence. */
  license: null;
  schemaVersion: 3;
};

export type RatingsPoll = {
  source: RatingsSource;
  wave: RatingsWave;
  previousWave: RatingsWave | null;
  sample: RatingsSample;
  /** Source row `Mittevalija`; excluded from the published party percentages. */
  withoutPartyPreferencePct: number | null;
  basis: "party-preference respondents";
  population: "Estonian citizens aged 18+";
  parties: RatingsParty[];
};

export type RatingsResponse = {
  poll: RatingsPoll;
  /** Time at which 117.ee successfully retrieved and parsed the source file. */
  fetchedAt: string;
  /** HTTP Last-Modified value from the source, normalized to ISO, when available. */
  sourceUpdatedAt: string | null;
};

export type RatingsUnavailableResponse = {
  error: string;
};
