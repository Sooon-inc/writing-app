import { NextRequest, NextResponse } from "next/server";
import * as ExcelJS from "exceljs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { HP_TEMPLATE_PATHS } from "@/lib/hpSitemap";

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

  const hpPageOutputs = JSON.parse(project.hpPageOutputs) as Record<
    string,
    Record<string, string>
  >;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(process.cwd(), templatePath));

  // Helper: find sheet by exact name or trimmed name
  const findSheet = (name: string) =>
    wb.getWorksheet(name) ??
    wb.worksheets.find((s) => s.name.trim() === name.trim());

  for (const [sheetName, rowContents] of Object.entries(hpPageOutputs)) {
    const sheet = findSheet(sheetName);
    if (!sheet) continue;

    for (const [rowNumStr, value] of Object.entries(rowContents)) {
      if (!value) continue;
      const rowNum = parseInt(rowNumStr);
      const row = sheet.getRow(rowNum);
      const cell = row.getCell(8); // Column H（H〜K列のマージセル先頭）
      // マージセルのスレーブの場合はマスターセルに書き込む
      const target = cell.isMerged && cell.master?.address !== cell.address
        ? cell.master
        : cell;
      target.value = value;
      row.commit();
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const fileName = encodeURIComponent(`${project.name}_HPヒアリングシート.xlsx`);

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`,
    },
  });
}
