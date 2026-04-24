import { NextRequest, NextResponse } from "next/server";
import * as ExcelJS from "exceljs";
import path from "path";
import { HP_TEMPLATE_PATHS } from "@/lib/hpSitemap";

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "";
  const sheetName = searchParams.get("sheetName") ?? "";

  const templatePath = HP_TEMPLATE_PATHS[type];
  if (!templatePath || !sheetName) return NextResponse.json({ fields: [] });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(process.cwd(), templatePath));

  const sheet =
    wb.getWorksheet(sheetName) ??
    wb.worksheets.find((s) => s.name.trim() === sheetName.trim());
  if (!sheet) return NextResponse.json({ fields: [] });

  const fields: { rn: number; section: string; label: string; condition: string }[] = [];
  sheet.eachRow((row, rn) => {
    const c2 = getCellText(row, 2);
    const c4 = getCellText(row, 4);  // 条件（必須/任意）
    const c5 = getCellText(row, 5);  // 項目名
    const c8 = getCellText(row, 8);  // 項目名（merged fallback）
    const c13 = getCellText(row, 13);
    const label = (c5 || c8 || "").trim();  // 項目名を使用
    const section = c2.trim();

    if (rn <= 4) return;
    if (!label || !section) return;
    if (label === "項目・要素" || label === "完成理想文字数") return;
    if (c13) return;
    if (
      label.includes("本文（文章") ||
      label.includes("完成理想") ||
      (label.includes("ページ") && section.includes("ページ"))
    ) return;

    fields.push({ rn, section, label, condition: c4 });
  });

  return NextResponse.json({ fields });
}
