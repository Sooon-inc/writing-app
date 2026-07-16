import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateHpDirectoryMetadata } from "@/lib/hpDirectoryMetadata";
import {
  DIRECTORY_OUTPUT_KEY,
  directoryMetadataToRows,
  type DirectoryRows,
} from "@/lib/directoryOutput";
import type { HpSitemapItem } from "@/lib/hpExportHelper";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { projectId } = (await req.json()) as { projectId: string };
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (!project.hpPageOutputs) {
      return NextResponse.json({ error: "生成済みページがありません" }, { status: 400 });
    }

    const hpPageOutputs = JSON.parse(project.hpPageOutputs) as Record<
      string,
      Record<string, string>
    >;
    const contentOutputs = Object.fromEntries(
      Object.entries(hpPageOutputs).filter(([key]) => key !== DIRECTORY_OUTPUT_KEY)
    );

    let sitemapItems: HpSitemapItem[] = [];
    try {
      if (project.sitemap) {
        const parsed = JSON.parse(project.sitemap) as Array<HpSitemapItem | string>;
        sitemapItems = parsed.flatMap((item) =>
          typeof item === "string" ? [{ id: item, sheetName: item }] : [item]
        );
      }
    } catch { /* ignore */ }

    let pageThemes: Record<string, string> = {};
    try {
      if (project.hpPageThemes) {
        pageThemes = JSON.parse(project.hpPageThemes) as Record<string, string>;
      }
    } catch { /* ignore */ }

    const metadata = await generateHpDirectoryMetadata(
      project.name,
      project.type,
      contentOutputs,
      sitemapItems,
      pageThemes
    );
    const directoryRows: DirectoryRows = directoryMetadataToRows(metadata);
    const mergedOutputs = {
      ...contentOutputs,
      [DIRECTORY_OUTPUT_KEY]: directoryRows,
    };

    await prisma.project.update({
      where: { id: projectId },
      data: { hpPageOutputs: JSON.stringify(mergedOutputs) },
    });

    return NextResponse.json({ directoryRows, hpPageOutputs: mergedOutputs });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[generate-directory] failed:", message);
    return NextResponse.json(
      { error: message || "ディレクトリ生成に失敗しました" },
      { status: 500 }
    );
  }
}
