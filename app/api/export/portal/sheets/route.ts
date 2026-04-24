import { NextRequest, NextResponse } from "next/server";
import * as ExcelJS from "exceljs";
import { Readable } from "stream";
import { cookies } from "next/headers";
import { google } from "googleapis";
import { PORTAL_SECTIONS, PORTAL_SECTION_GROUPS } from "@/lib/templates/portal";

const BEIGE = "FFFEF3C7";
const GRAY = "FFE5E7EB";
const GROUP_COLORS: Record<string, string> = {
  "基本情報":        "FFD1FAE5",
  "こだわりポイント": "FFDBEAFE",
  "ストーリー情報":  "FFEDE9FE",
};

function str(v: unknown): string {
  return v != null ? String(v) : "";
}

function getGroup(key: string): string {
  for (const g of PORTAL_SECTION_GROUPS) {
    if ((g.keys as readonly string[]).includes(key)) return g.label;
  }
  return "";
}

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

  const { output, projectName } = await req.json();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("ポータル情報");

  // 列幅設定（26列）
  PORTAL_SECTIONS.forEach((_, i) => {
    sheet.getColumn(i + 1).width = 22;
  });

  // 行1: グループラベル
  const groupRow = sheet.addRow(PORTAL_SECTIONS.map((key) => getGroup(key)));
  PORTAL_SECTIONS.forEach((key, i) => {
    const cell = groupRow.getCell(i + 1);
    const groupName = getGroup(key);
    cell.font = { bold: true, size: 9, color: { argb: "FF374151" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GROUP_COLORS[groupName] ?? GRAY } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { right: { style: "thin", color: { argb: "FFCBD5E1" } } };
  });
  groupRow.height = 18;

  // 行2: 項目名（ヘッダー）
  const headerRow = sheet.addRow(PORTAL_SECTIONS.map((s) => s));
  PORTAL_SECTIONS.forEach((_, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.font = { bold: true, size: 9 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRAY } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF6B7280" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });
  headerRow.height = 22;

  // 行3: 値
  const valueRow = sheet.addRow(PORTAL_SECTIONS.map((key) => str((output as Record<string, unknown>)[key])));
  PORTAL_SECTIONS.forEach((_, i) => {
    const cell = valueRow.getCell(i + 1);
    cell.font = { size: 9 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BEIGE } };
    cell.alignment = { wrapText: true, vertical: "top" };
    cell.border = { right: { style: "thin", color: { argb: "FFCBD5E1" } } };
    const val = str((output as Record<string, unknown>)[PORTAL_SECTIONS[i]]);
    const lines = val ? val.split("\n").length : 1;
    valueRow.height = Math.max(40, lines * 15);
  });

  const buffer = await workbook.xlsx.writeBuffer();

  const drive = google.drive({ version: "v3", auth: oauth2Client });
  let file;
  try {
    file = await drive.files.create({
      requestBody: {
        name: `${projectName ?? "ポータル"}_情報整理`,
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
