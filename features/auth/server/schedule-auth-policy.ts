export const SCHEDULE_PATH = "/ajakava";
export const MARKET_PATH = "/turg";
export const SCHEDULE_SIGN_IN_PATH = "/sisene";

export type PrivatePath = typeof SCHEDULE_PATH | typeof MARKET_PATH;

export function isPrivatePath(value: string): value is PrivatePath {
  return value === SCHEDULE_PATH || value === MARKET_PATH;
}

export function normalizePrivatePath(value: string | undefined): PrivatePath {
  return value === MARKET_PATH ? MARKET_PATH : SCHEDULE_PATH;
}

const REQUIRED_CONFIGURATION_KEYS = [
  "AUTH_SECRET",
  "AUTH_GITHUB_ID",
  "AUTH_GITHUB_SECRET",
  "SCHEDULE_ALLOWED_GITHUB_ID",
  "DATABASE_URL",
  "SCHEDULE_DATA_KEY",
] as const;

type RequiredConfigurationKey = (typeof REQUIRED_CONFIGURATION_KEYS)[number]
  | "AUTH_TRUST_HOST"
  | "AUTH_URL";

export type ScheduleAuthEnvironment = Readonly<{
  NODE_ENV?: string;
  AUTH_SECRET?: string;
  AUTH_GITHUB_ID?: string;
  AUTH_GITHUB_SECRET?: string;
  AUTH_TRUST_HOST?: string;
  AUTH_URL?: string;
  SCHEDULE_ALLOWED_GITHUB_ID?: string;
  DATABASE_URL?: string;
  SCHEDULE_DATA_KEY?: string;
  SCHEDULE_DEV_BYPASS?: string;
}>;

export type ScheduleAuthState = Readonly<{
  configured: boolean;
  allowedGithubId: string | null;
  developmentBypass: boolean;
  missingKeys: readonly RequiredConfigurationKey[];
}>;

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasStrongAuthSecret(value: string | undefined): boolean {
  if (!hasValue(value)) return false;
  const byteLength = new TextEncoder().encode(value).byteLength;
  return byteLength >= 32 && byteLength <= 4_096;
}

function hasPostgresUrl(value: string | undefined): boolean {
  try {
    const protocol = new URL(value?.trim() ?? "").protocol;
    return protocol === "postgres:" || protocol === "postgresql:";
  } catch {
    return false;
  }
}

function hasScheduleDataKey(value: string | undefined): boolean {
  return /^[A-Za-z0-9_-]{43}$/u.test(value?.trim() ?? "");
}

function hasProductionAuthUrl(value: string | undefined): boolean {
  try {
    const url = new URL(value?.trim() ?? "");
    return url.origin === "https://117.ee"
      && url.pathname === "/"
      && !url.search
      && !url.hash
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

export function normalizeGithubAccountId(value: string | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return /^[1-9]\d{0,19}$/.test(normalized) ? normalized : null;
}

export function isScheduleDevelopmentBypassEnabled(
  environment: ScheduleAuthEnvironment,
): boolean {
  return environment.NODE_ENV === "development"
    && environment.SCHEDULE_DEV_BYPASS === "1";
}

export function getScheduleAuthState(
  environment: ScheduleAuthEnvironment,
): ScheduleAuthState {
  const missingKeys: RequiredConfigurationKey[] = REQUIRED_CONFIGURATION_KEYS.filter(
    (key) => {
      if (key === "AUTH_SECRET") return !hasStrongAuthSecret(environment[key]);
      if (key === "DATABASE_URL") return !hasPostgresUrl(environment[key]);
      if (key === "SCHEDULE_DATA_KEY") return !hasScheduleDataKey(environment[key]);
      return !hasValue(environment[key]);
    },
  );
  if (
    environment.NODE_ENV === "production"
    && environment.AUTH_TRUST_HOST !== "true"
  ) {
    missingKeys.push("AUTH_TRUST_HOST");
  }
  if (
    environment.NODE_ENV === "production"
    && !hasProductionAuthUrl(environment.AUTH_URL)
  ) {
    missingKeys.push("AUTH_URL");
  }
  const allowedGithubId = normalizeGithubAccountId(
    environment.SCHEDULE_ALLOWED_GITHUB_ID,
  );

  return {
    configured: missingKeys.length === 0 && allowedGithubId !== null,
    allowedGithubId,
    developmentBypass: isScheduleDevelopmentBypassEnabled(environment),
    missingKeys,
  };
}

export function isAllowedScheduleGithubAccount(
  providerAccountId: string | undefined,
  environment: ScheduleAuthEnvironment,
): boolean {
  const state = getScheduleAuthState(environment);
  return state.configured
    && normalizeGithubAccountId(providerAccountId) === state.allowedGithubId;
}

export function fixedScheduleRedirect(requestedUrl: string, baseUrl: string): string {
  try {
    const base = new URL(baseUrl);
    const localHost = base.hostname === "localhost"
      || base.hostname === "127.0.0.1";
    const allowedOrigin = base.origin === "https://117.ee"
      || (localHost && (base.protocol === "http:" || base.protocol === "https:"));
    if (!allowedOrigin) return SCHEDULE_PATH;
    const requested = new URL(requestedUrl, base.origin);
    const destination = requested.origin === base.origin
      && isPrivatePath(requested.pathname)
      && !requested.search
      && !requested.hash
      ? requested.pathname
      : SCHEDULE_PATH;
    return new URL(destination, base.origin).toString();
  } catch {
    return SCHEDULE_PATH;
  }
}

export function isAuthJsSessionCookieName(name: string): boolean {
  return name === "authjs.session-token"
    || name.startsWith("authjs.session-token.")
    || name === "__Secure-authjs.session-token"
    || name.startsWith("__Secure-authjs.session-token.");
}

export function hasAuthJsSessionCookie(cookieNames: readonly string[]): boolean {
  return cookieNames.some(isAuthJsSessionCookieName);
}
