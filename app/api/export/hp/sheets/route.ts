import { NextRequest, NextResponse } from "next/server";
import * as ExcelJS from "exceljs";
import path from "path";
import { Readable } from "stream";
import { cookies } from "next/headers";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { HP_TEMPLATE_PATHS } from "@/lib/hpSitemap";
import { applyHpOutputsToWorkbook, HpSitemapItem } from "@/lib/hpExportHelper";

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

  const { projectId } = (await req.json()) as { projectId: string };
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!project.hpPageOutputs) {
    return NextResponse.json({ error: "No generated content found" }, { status: 400 });
  }

  const templatePath = HP_TEMPLATE_PATHS[project.type];
  if (!templatePath) {
    return NextResponse.json({ error: "Unsupported HP type" }, { status: 400 });
  }

  const hpPageOutputs = JSON.parse(project.hpPageOutputs) as Record<string, Record<string, string>>;

  // sitemap から sitemapItems を復元
  let sitemapItems: HpSitemapItem[] = [];
  try {
    if (project.sitemap) {
      const parsed = JSON.parse(project.sitemap) as Array<HpSitemapItem | string>;
      sitemapItems = parsed.flatMap((item) =>
        typeof item === "string" ? [{ id: item, sheetName: item }] : [item]
      );
    }
  } catch { /* ignore */ }

  // pageThemes を復元
  let pageThemes: Record<string, string> = {};
  try {
    if (project.hpPageThemes) pageThemes = JSON.parse(project.hpPageThemes) as Record<string, string>;
  } catch { /* ignore */ }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(process.cwd(), templatePath));

  applyHpOutputsToWorkbook(wb, hpPageOutputs, sitemapItems, pageThemes);

  const buffer = await wb.xlsx.writeBuffer();

  const drive = google.drive({ version: "v3", auth: oauth2Client });
  let file;
  try {
    file = await drive.files.create({
      requestBody: {
        name: `${project.name}_HPヒアリングシート`,
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
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Drive permissions.create error:", msg);
  }

  return NextResponse.json({ url: file.data.webViewLink });
}
