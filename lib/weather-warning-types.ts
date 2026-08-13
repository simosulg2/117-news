export type WeatherWarningLevel = 1 | 2 | 3;

export type WeatherWarning = {
  id: string;
  revisionId: string;
  area: string;
  /** Null means the official source published an ungraded nationwide notice. */
  level: WeatherWarningLevel | null;
  phenomenon: string;
  description: string;
  validFrom: string | null;
  validTo: string | null;
};

export type WeatherWarningsResponse = {
  area: "Võru maakond";
  warnings: WeatherWarning[];
  fetchedAt: string;
  sourceUpdatedAt: string | null;
  source: {
    name: "Keskkonnaagentuur / Ilmateenistus";
    url: string;
    documentationUrl: string;
    license: "CC BY 4.0";
  };
};
