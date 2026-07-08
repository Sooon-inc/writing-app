import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { google } from "googleapis";
import { getGoogleRedirectUri } from "@/lib/googleOAuth";

function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

export async function POST(req: NextRequest) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getGoogleRedirectUri(req)
  );

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("g_access_token")?.value;
  const refreshToken = cookieStore.get("g_refresh_token")?.value;
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

  const { url } = (await req.json()) as { url: string };
  const sheetId = extractSheetId(url);
  if (!sheetId) {
    return NextResponse.json({ error: "無効なスプレッドシートURLです" }, { status: 400 });
  }

  try {
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });

    // シート名一覧を取得してから全シートのデータを読む
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const sheetNames = (meta.data.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean);

    const allParts: string[] = [];

    for (const sheetName of sheetNames) {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${sheetName}!A:B`,
      });
      const rows = res.data.values ?? [];
      if (rows.length === 0) continue;

      const lines: string[] = [];
      for (const row of rows) {
        const label = (row[0] ?? "").toString().trim();
        const value = (row[1] ?? "").toString().trim();
        if (!label && !value) continue;
        if (label && value) {
          lines.push(`${label}：${value}`);
        } else if (label) {
          lines.push(label);
        } else if (value) {
          lines.push(value);
        }
      }
      if (lines.length > 0) {
        allParts.push(`【${sheetName}】\n${lines.join("\n")}`);
      }
    }

    const content = allParts.join("\n\n");
    return NextResponse.json({ content });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("read-sheets error:", msg);
    return NextResponse.json({ error: `スプレッドシートの読み込みに失敗しました: ${msg}` }, { status: 500 });
  }
}
