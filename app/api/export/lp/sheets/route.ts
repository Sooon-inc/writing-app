import { NextRequest, NextResponse } from "next/server";
import * as ExcelJS from "exceljs";
import path from "path";
import { Readable } from "stream";
import { cookies } from "next/headers";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

const LP_TEMPLATE_PATH = "templates/lp/lp.xlsx";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "http://localhost:3000/api/auth/google/callback"
);

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("g_access_token")?.value;
  const refreshToken = cookieStore.get("g_refresh_token")?.value;
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

  const { projectId } = (await req.json()) as { projectId: string };
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!project.hpPageOutputs) {
    return NextResponse.json({ error: "No generated content found" }, { status: 400 });
  }

  const outputs = JSON.parse(project.hpPageOutputs) as Record<string, Record<string, string>>;
  const lpRows = outputs["LP"] ?? {};

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(process.cwd(), LP_TEMPLATE_PATH));

  const sheet = wb.getWorksheet("LP");
  if (!sheet) return NextResponse.json({ error: "LP sheet not found" }, { status: 500 });

  for (const [rowNumStr, value] of Object.entries(lpRows)) {
    if (!value) continue;
    const rowNum = parseInt(rowNumStr);
    const row = sheet.getRow(rowNum);
    const cell = row.getCell(10);
    cell.value = value;
    row.commit();
  }

  const buffer = await wb.xlsx.writeBuffer();

  const drive = google.drive({ version: "v3", auth: oauth2Client });
  let file;
  try {
    file = await drive.files.create({
      requestBody: {
        name: `${project.name}_LPヒアリングシート`,
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
