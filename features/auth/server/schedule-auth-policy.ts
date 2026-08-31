export const SCHEDULE_PATH = "/ajakava";
export const SCHEDULE_SIGN_IN_PATH = "/sisene";

const REQUIRED_CONFIGURATION_KEYS = [
  "AUTH_SECRET",
  "AUTH_GITHUB_ID",
  "AUTH_GITHUB_SECRET",
  "SCHEDULE_ALLOWED_GITHUB_ID",
] as const;

type RequiredConfigurationKey = (typeof REQUIRED_CONFIGURATION_KEYS)[number]
  | "AUTH_TRUST_HOST";

export type ScheduleAuthEnvironment = Readonly<{
  NODE_ENV?: string;
  AUTH_SECRET?: string;
  AUTH_GITHUB_ID?: string;
  AUTH_GITHUB_SECRET?: string;
  AUTH_TRUST_HOST?: string;
  SCHEDULE_ALLOWED_GITHUB_ID?: string;
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
    (key) => key === "AUTH_SECRET"
      ? !hasStrongAuthSecret(environment[key])
      : !hasValue(environment[key]),
  );
  if (
    environment.NODE_ENV === "production"
    && environment.AUTH_TRUST_HOST !== "true"
  ) {
    missingKeys.push("AUTH_TRUST_HOST");
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

export function fixedScheduleRedirect(_requestedUrl: string, baseUrl: string): string {
  try {
    const base = new URL(baseUrl);
    if (base.protocol !== "https:" && base.protocol !== "http:") return SCHEDULE_PATH;
    return new URL(SCHEDULE_PATH, base.origin).toString();
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
