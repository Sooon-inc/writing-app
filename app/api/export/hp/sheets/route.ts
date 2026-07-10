import { NextRequest, NextResponse } from "next/server";
import * as ExcelJS from "exceljs";
import path from "path";
import { cookies } from "next/headers";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { HP_TEMPLATE_PATHS } from "@/lib/hpSitemap";
import { applyHpOutputsToWorkbook, HpSitemapItem } from "@/lib/hpExportHelper";
import { DRIVE_FOLDER_IDS, uploadToGoogleSheets } from "@/lib/driveUpload";
import { getGoogleRedirectUri } from "@/lib/googleOAuth";

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

  let buffer: ExcelJS.Buffer;
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(process.cwd(), templatePath));
    // hp-strong: シートごとに書き込み列を指定（デフォルトは H 列=8）
    const fixedSheetColMap = project.type === "hp-strong" ? {
      "トップ": 9,               // I 列
      "代表挨拶・スタッフ紹介": 7, // G 列
    } : undefined;
    applyHpOutputsToWorkbook(wb, hpPageOutputs, sitemapItems, pageThemes, fixedSheetColMap);
    buffer = await wb.xlsx.writeBuffer();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Excel build error:", msg);
    return NextResponse.json({ error: `Excelファイル生成エラー: ${msg}` }, { status: 500 });
  }

  try {
    const { webViewLink } = await uploadToGoogleSheets(
      oauth2Client,
      `${project.name}_HPヒアリングシート`,
      Buffer.from(buffer),
      DRIVE_FOLDER_IDS.hp
    );
    return NextResponse.json({ url: webViewLink });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Drive upload error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
