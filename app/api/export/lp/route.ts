import { NextRequest, NextResponse } from "next/server";
import * as ExcelJS from "exceljs";
import path from "path";
import { prisma } from "@/lib/prisma";

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

  const sheet = wb.getWorksheet("LP");
  if (!sheet) return NextResponse.json({ error: "LP sheet not found" }, { status: 500 });

  for (const [rowNumStr, value] of Object.entries(lpRows)) {
    if (!value) continue;
    const rowNum = parseInt(rowNumStr);
    const row = sheet.getRow(rowNum);
    const cell = row.getCell(10); // Column J (C10)
    cell.value = value;
    row.commit();
  }

  const buffer = await wb.xlsx.writeBuffer();
  const fileName = encodeURIComponent(`${project.name}_LPヒアリングシート.xlsx`);

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`,
    },
  });
}
