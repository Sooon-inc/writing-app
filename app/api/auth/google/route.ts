import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

function getCallbackUrl(req: NextRequest): string {
  const origin = req.nextUrl.origin; // e.g. http://localhost:3001
  return `${origin}/api/auth/google/callback`;
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId") ?? "";
  const sheetType = req.nextUrl.searchParams.get("sheetType") ?? "";
  const state = JSON.stringify({ projectId, sheetType });

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getCallbackUrl(req)
  );

  const callbackUrl = getCallbackUrl(req);
  console.log("[auth] redirect_uri being sent to Google:", callbackUrl);

  const authUrl = oauth2Client.generateAuthUrl({
    scope: ["https://www.googleapis.com/auth/drive.file"],
    access_type: "offline",
    state,
    prompt: "consent",
  });

  // authURL内のredirect_uriパラメータを確認
  const parsedAuthUrl = new URL(authUrl);
  console.log("[auth] redirect_uri in authUrl:", parsedAuthUrl.searchParams.get("redirect_uri"));

  return NextResponse.redirect(authUrl);
}
