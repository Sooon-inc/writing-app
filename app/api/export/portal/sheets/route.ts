import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { google } from "googleapis";
import { DRIVE_FOLDER_IDS, uploadToGoogleSheets } from "@/lib/driveUpload";
import { buildPortalWorkbook } from "@/lib/portalExcelBuilder";
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

  try {
    const { output, projectName } = (await req.json()) as {
      output?: Record<string, unknown>;
      projectName?: string;
    };
    if (!output) {
      return NextResponse.json({ error: "生成済みのポータル原稿がありません" }, { status: 400 });
    }

    const workbook = await buildPortalWorkbook(output);
    const buffer = await workbook.xlsx.writeBuffer();
    const { webViewLink } = await uploadToGoogleSheets(
      oauth2Client,
      `${projectName ?? "ポータル"}_Nexus-by-Homeヒアリングシート`,
      Buffer.from(buffer),
      DRIVE_FOLDER_IDS.portal
    );
    return NextResponse.json({ url: webViewLink });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Portal Sheets export error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
