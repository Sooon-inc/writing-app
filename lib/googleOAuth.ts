import { NextRequest } from "next/server";

const DEFAULT_APP_ORIGIN = "http://localhost:3210";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getAppOrigin(req?: NextRequest): string {
  if (req && req.nextUrl.origin.startsWith("https://")) {
    return trimTrailingSlash(req.nextUrl.origin);
  }

  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_ORIGIN ||
    DEFAULT_APP_ORIGIN;

  if (configured) return trimTrailingSlash(configured);
  return req ? req.nextUrl.origin : DEFAULT_APP_ORIGIN;
}

export function getGoogleRedirectUri(req?: NextRequest): string {
  if (req && req.nextUrl.origin.startsWith("https://")) {
    return `${trimTrailingSlash(req.nextUrl.origin)}/api/auth/google/callback`;
  }

  const configured = process.env.GOOGLE_REDIRECT_URI;
  if (configured) return configured.trim();
  return `${getAppOrigin(req)}/api/auth/google/callback`;
}

export function getProjectRedirectUrl(
  req: NextRequest,
  projectId: string,
  sheetType?: string
): URL {
  const appOrigin = getAppOrigin(req);
  const url = new URL(`/projects/${projectId || ""}`, appOrigin);
  if (sheetType) url.searchParams.set("openSheet", sheetType);
  return url;
}
