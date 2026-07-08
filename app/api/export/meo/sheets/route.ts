import { NextRequest, NextResponse } from "next/server";
import * as ExcelJS from "exceljs";
import { cookies } from "next/headers";
import { google } from "googleapis";
import { buildMeoWorkbook } from "@/lib/meoExcelBuilder";
import { DRIVE_FOLDER_IDS, uploadToGoogleSheets } from "@/lib/driveUpload";
import { getGoogleRedirectUri } from "@/lib/googleOAuth";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("g_access_token")?.value;
  const refreshToken = cookieStore.get("g_refresh_token")?.value;
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getGoogleRedirectUri(req)
  );
  oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

  let output, projectName, hpUrl;
  try {
    ({ output, projectName, hpUrl } = await req.json());
  } catch (e) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  let buffer: ExcelJS.Buffer;
  try {
    const workbook = await buildMeoWorkbook(output, projectName ?? "", hpUrl ?? "");
    buffer = await workbook.xlsx.writeBuffer();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Excel build error:", msg);
    return NextResponse.json({ error: `Excelファイル生成エラー: ${msg}` }, { status: 500 });
  }

  try {
    const { webViewLink } = await uploadToGoogleSheets(
      oauth2Client,
      `${projectName}_MEOヒアリングシート`,
      Buffer.from(buffer),
      DRIVE_FOLDER_IDS.meo
    );
    return NextResponse.json({ url: webViewLink });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Drive upload error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
