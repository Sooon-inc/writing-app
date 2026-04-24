import { NextResponse } from "next/server";
import * as ExcelJS from "exceljs";
import path from "path";

function getCellText(row: ExcelJS.Row, colIndex: number): string {
  const cell = row.getCell(colIndex);
  const v = cell.value;
  if (!v) return "";
  if (typeof v === "object" && "richText" in v) {
    return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("").trim();
  }
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return "";
}

export async function GET() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(process.cwd(), "templates/lp/lp.xlsx"));

  const sheet = wb.getWorksheet("LP");
  if (!sheet) return NextResponse.json({ fields: [] });

  const fields: { rn: number; section: string; label: string; condition: string }[] = [];
  sheet.eachRow((row, rn) => {
    if (rn <= 8) return;
    const section = getCellText(row, 2).replace(/\n/g, " ").trim();
    const condition = getCellText(row, 4).trim();
    const label = getCellText(row, 5).trim();
    if (!label || !section) return;
    if (condition === "記入不要") return;
    if (label === "項目・要素") return;
    fields.push({ rn, section, label, condition });
  });

  return NextResponse.json({ fields });
}
