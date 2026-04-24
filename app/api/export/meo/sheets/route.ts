import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { cookies } from "next/headers";
import { google } from "googleapis";
import { buildMeoWorkbook } from "@/lib/meoExcelBuilder";

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
    `${req.nextUrl.origin}/api/auth/google/callback`
  );
  oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

  const { output, projectName, hpUrl } = await req.json();

  const workbook = buildMeoWorkbook(output, projectName ?? "", hpUrl ?? "");
  const buffer = await workbook.xlsx.writeBuffer();

  const drive = google.drive({ version: "v3", auth: oauth2Client });
  let file;
  try {
    file = await drive.files.create({
      requestBody: {
        name: `${projectName}_MEOヒアリングシート`,
        mimeType: "application/vnd.google-apps.spreadsheet",
      },
      media: {
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        body: Readable.from(Buffer.from(buffer)),
      },
      fields: "id,webViewLink",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Drive files.create error:", msg);
    return NextResponse.json({ error: `Drive API error: ${msg}` }, { status: 500 });
  }

  try {
    await drive.permissions.create({
      fileId: file.data.id!,
      requestBody: { role: "writer", type: "anyone" },
    });
  } catch (e: unknown) {
    console.error("Drive permissions.create error:", e);
  }

  return NextResponse.json({ url: file.data.webViewLink });
}
