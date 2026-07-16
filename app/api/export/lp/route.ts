import { NextRequest, NextResponse } from "next/server";
import * as ExcelJS from "exceljs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { applyLpOutputsToWorkbook } from "@/lib/lpExportHelper";

const LP_TEMPLATE_PATH = "templates/lp/lp.xlsx";

export async function POST(req: NextRequest) {
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

  applyLpOutputsToWorkbook(wb, lpRows);

  const buffer = await wb.xlsx.writeBuffer();
  const fileName = encodeURIComponent(`${project.name}_LPヒアリングシート.xlsx`);

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`,
    },
  });
}
