import { NextRequest, NextResponse } from "next/server";
import * as ExcelJS from "exceljs";
import path from "path";
import { cookies } from "next/headers";
import { google } from "googleapis";
import { DRIVE_FOLDER_IDS, uploadToGoogleSheets } from "@/lib/driveUpload";
import { prisma } from "@/lib/prisma";
import { getGoogleRedirectUri } from "@/lib/googleOAuth";

const LP_TEMPLATE_PATH = "templates/lp/lp.xlsx";
export const maxDuration = 300;

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

  const { projectId } = (await req.json()) as { projectId: string };
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!project.hpPageOutputs) {
    return NextResponse.json({ error: "No generated content found" }, { status: 400 });
  }

  const outputs = JSON.parse(project.hpPageOutputs) as Record<string, Record<string, string>>;
  const lpRows = outputs["LP"] ?? {};

  let buffer: ExcelJS.Buffer;
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(process.cwd(), LP_TEMPLATE_PATH));
    const sheet = wb.getWorksheet("LP");
    if (!sheet) throw new Error("LP sheet not found in template");
    for (const [rowNumStr, value] of Object.entries(lpRows)) {
      if (!value) continue;
      const rowNum = parseInt(rowNumStr);
      const row = sheet.getRow(rowNum);
      const cell = row.getCell(10);
      cell.value = value;
      row.commit();
    }
    buffer = await wb.xlsx.writeBuffer();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Excel build error:", msg);
    return NextResponse.json({ error: `Excelファイル生成エラー: ${msg}` }, { status: 500 });
  }

  try {
    const { webViewLink } = await uploadToGoogleSheets(
      oauth2Client,
      `${project.name}_LPヒアリングシート`,
      Buffer.from(buffer),
      DRIVE_FOLDER_IDS.lp
    );
    return NextResponse.json({ url: webViewLink });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Drive upload error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
