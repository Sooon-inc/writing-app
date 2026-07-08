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

  const fields: { rn: number; section: string; label: string; condition: string; group: string }[] = [];
  let currentSection = "";
  let currentGroup = "";

  sheet.eachRow((row, rn) => {
    const c2 = getCellText(row, 2);
    const c4 = getCellText(row, 4);  // 条件（必須/任意）or サブグループ名
    const c5 = getCellText(row, 5);  // 項目名
    const c8 = getCellText(row, 8);  // 項目名（merged fallback）
    const c13 = getCellText(row, 13);

    if (rn <= 4) return;

    // セクション名は最初の行のみ（注釈を除去）
    const section = c2.split("\n")[0].trim();
    const label = (c5 || c8 || "").trim();

    // セクションが変わったらグループをリセット
    if (section && section !== currentSection) {
      currentSection = section;
      currentGroup = "";
    }

    // c13="-" はサブグループヘッダー行（一つ目, 二つ目, 上段, 下段 など）
    if (c13) {
      if (c13 === "-") {
        currentGroup = (c5 || c4 || "").trim();
      }
      return;
    }

    if (!label || !section) return;
    if (label === "項目・要素" || label === "完成理想文字数") return;
    // セクション名とラベルが同じ行はナビゲーション/説明行なのでスキップ
    if (label === section) return;
    if (
      label.includes("本文（文章") ||
      label.includes("完成理想") ||
      (label.includes("ページ") && section.includes("ページ"))
    ) return;

    fields.push({ rn, section, label, condition: c4, group: currentGroup });
  });

  return NextResponse.json({ fields });
}
