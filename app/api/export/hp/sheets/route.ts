import { NextRequest, NextResponse } from "next/server";
import * as ExcelJS from "exceljs";
import path from "path";
import { cookies } from "next/headers";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { HP_SITEMAPS, HP_TEMPLATE_PATHS } from "@/lib/hpSitemap";
import { applyHpOutputsToWorkbook, HpSitemapItem } from "@/lib/hpExportHelper";
import { type DriveOutputType, uploadToGoogleSheets } from "@/lib/driveUpload";
import { getGoogleRedirectUri } from "@/lib/googleOAuth";
import { generateHpDirectoryMetadata } from "@/lib/hpDirectoryMetadata";
import {
  DIRECTORY_OUTPUT_KEY,
  directoryRowsToMetadata,
} from "@/lib/directoryOutput";
import { syncBeautyTopSection04 } from "@/lib/beautyTopServices";

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

  const body = (await req.json()) as {
    projectId: string;
    hpPageOutputs?: Record<string, Record<string, string>>;
    sitemapItems?: HpSitemapItem[];
    pageThemes?: Record<string, string>;
  };
  const { projectId } = body;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!project.hpPageOutputs) {
    return NextResponse.json({ error: "No generated content found" }, { status: 400 });
  }

  const templatePath = HP_TEMPLATE_PATHS[project.type];
  if (!templatePath) {
    return NextResponse.json({ error: "Unsupported HP type" }, { status: 400 });
  }

  // 画面で編集・追加された直後でも欠落しないよう、リクエストに最新の
  // スナップショットがあればDBの旧値より優先する。
  const hpPageOutputs = body.hpPageOutputs ??
    JSON.parse(project.hpPageOutputs) as Record<string, Record<string, string>>;
  let contentOutputs = Object.fromEntries(
    Object.entries(hpPageOutputs).filter(([key]) => key !== DIRECTORY_OUTPUT_KEY)
  );

  // sitemap から sitemapItems を復元
  let sitemapItems: HpSitemapItem[] = Array.isArray(body.sitemapItems)
    ? body.sitemapItems
    : [];
  try {
    if (sitemapItems.length === 0 && project.sitemap) {
      const parsed = JSON.parse(project.sitemap) as Array<HpSitemapItem | string>;
      sitemapItems = parsed.flatMap((item) =>
        typeof item === "string" ? [{ id: item, sheetName: item }] : [item]
      );
    }
  } catch { /* ignore */ }

  // pageThemes を復元
  let pageThemes: Record<string, string> = body.pageThemes ?? {};
  try {
    if (Object.keys(pageThemes).length === 0 && project.hpPageThemes) {
      pageThemes = JSON.parse(project.hpPageThemes) as Record<string, string>;
    }
  } catch { /* ignore */ }

  contentOutputs = syncBeautyTopSection04(
    project.type,
    contentOutputs,
    sitemapItems,
    pageThemes
  );

  let buffer: ExcelJS.Buffer;
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(process.cwd(), templatePath));
    const storedDirectoryMetadata = directoryRowsToMetadata(
      hpPageOutputs[DIRECTORY_OUTPUT_KEY]
    );
    const directoryMetadata = storedDirectoryMetadata.length > 0
      ? storedDirectoryMetadata
      : await generateHpDirectoryMetadata(
          project.name,
          project.type,
          contentOutputs,
          sitemapItems,
          pageThemes
        );
    // テンプレートごとの本文入力列。クラシックは指定原本の空白列に合わせる。
    const fixedSheetColMap: Record<string, number> | undefined = project.type === "hp-strong" ? {
      "トップ": 9,               // I 列
      "代表挨拶・スタッフ紹介": 7, // G 列
    } : project.type === "hp-classic" ? {
      "トップ": 9,       // I 列
      "会社概要": 8,     // H 列
      "当社について": 7, // G 列
      "代表挨拶": 7,     // G 列
      "よくある質問": 7, // G 列
      "採用情報": 7,     // G 列
    } : undefined;
    applyHpOutputsToWorkbook(
      wb,
      contentOutputs,
      sitemapItems,
      pageThemes,
      fixedSheetColMap,
      directoryMetadata,
      (HP_SITEMAPS[project.type] ?? [])
        .filter((page) => page.fixed && page.sheetName)
        .map((page) => page.sheetName!)
    );
    buffer = await wb.xlsx.writeBuffer();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Excel build error:", msg);
    return NextResponse.json({ error: `Excelファイル生成エラー: ${msg}` }, { status: 500 });
  }

  try {
    const { webViewLink, warning } = await uploadToGoogleSheets(
      oauth2Client,
      `${project.name}_HPヒアリングシート`,
      Buffer.from(buffer),
      project.type as DriveOutputType
    );
    return NextResponse.json({ url: webViewLink, warning });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Drive upload error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
