import { NextRequest, NextResponse } from "next/server";
import * as ExcelJS from "exceljs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { HP_TEMPLATE_PATHS } from "@/lib/hpSitemap";
import { applyHpOutputsToWorkbook, HpSitemapItem } from "@/lib/hpExportHelper";
import { generateHpDirectoryMetadata } from "@/lib/hpDirectoryMetadata";
import {
  DIRECTORY_OUTPUT_KEY,
  directoryRowsToMetadata,
} from "@/lib/directoryOutput";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
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
  const contentOutputs = Object.fromEntries(
    Object.entries(hpPageOutputs).filter(([key]) => key !== DIRECTORY_OUTPUT_KEY)
  );

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

  // hp-strong: シートごとに書き込み列を指定（デフォルトは H 列=8）
  const fixedSheetColMap = project.type === "hp-strong" ? {
    "トップ": 9,               // I 列
    "代表挨拶・スタッフ紹介": 7, // G 列
  } : undefined;
  applyHpOutputsToWorkbook(
    wb,
    contentOutputs,
    sitemapItems,
    pageThemes,
    fixedSheetColMap,
    directoryMetadata
  );

  const buffer = await wb.xlsx.writeBuffer();
  const fileName = encodeURIComponent(`${project.name}_HPヒアリングシート.xlsx`);

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`,
    },
  });
}
