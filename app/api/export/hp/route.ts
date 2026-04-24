import { NextRequest, NextResponse } from "next/server";
import * as ExcelJS from "exceljs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { HP_TEMPLATE_PATHS } from "@/lib/hpSitemap";
import { applyHpOutputsToWorkbook, HpSitemapItem } from "@/lib/hpExportHelper";

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
  const fileName = encodeURIComponent(`${project.name}_HPヒアリングシート.xlsx`);

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`,
    },
  });
}
