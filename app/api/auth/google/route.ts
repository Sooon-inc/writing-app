import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "http://localhost:3000/api/auth/google/callback"
);

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId") ?? "";
  const sheetType = req.nextUrl.searchParams.get("sheetType") ?? "";
  const state = JSON.stringify({ projectId, sheetType });
  const authUrl = oauth2Client.generateAuthUrl({
    scope: ["https://www.googleapis.com/auth/drive.file"],
    access_type: "offline",
    state,
    prompt: "consent",
  });
  return NextResponse.redirect(authUrl);
}
