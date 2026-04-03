import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "http://localhost:3000/api/auth/google/callback"
);

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code") ?? "";
  const stateRaw = req.nextUrl.searchParams.get("state") ?? "{}";

  let projectId = "";
  let sheetType = "";
  try {
    const state = JSON.parse(stateRaw);
    projectId = state.projectId ?? "";
    sheetType = state.sheetType ?? "";
  } catch {
    projectId = stateRaw;
  }

  const { tokens } = await oauth2Client.getToken(code);

  const redirectUrl = new URL(`/projects/${projectId}`, req.url);
  if (sheetType) redirectUrl.searchParams.set("openSheet", sheetType);

  const res = NextResponse.redirect(redirectUrl);

  if (tokens.access_token) {
    res.cookies.set("g_access_token", tokens.access_token, {
      httpOnly: true,
      path: "/",
      maxAge: 3600,
    });
  }
  if (tokens.refresh_token) {
    res.cookies.set("g_refresh_token", tokens.refresh_token, {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return res;
}
