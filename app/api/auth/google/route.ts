import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getGoogleRedirectUri } from "@/lib/googleOAuth";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId") ?? "";
  const sheetType = req.nextUrl.searchParams.get("sheetType") ?? "";
  const state = JSON.stringify({ projectId, sheetType });

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getGoogleRedirectUri(req)
  );

  const callbackUrl = getGoogleRedirectUri(req);
  console.log("[auth] redirect_uri being sent to Google:", callbackUrl);

  const authUrl = oauth2Client.generateAuthUrl({
    // ユーザー指定の既存フォルダへ格納するため、Drive全体へのアクセスが必要
    scope: ["https://www.googleapis.com/auth/drive"],
    access_type: "offline",
    state,
    prompt: "consent",
  });

  // authURL内のredirect_uriパラメータを確認
  const parsedAuthUrl = new URL(authUrl);
  console.log("[auth] redirect_uri in authUrl:", parsedAuthUrl.searchParams.get("redirect_uri"));

  return NextResponse.redirect(authUrl);
}
