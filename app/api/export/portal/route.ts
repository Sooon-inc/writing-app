import { NextResponse } from "next/server";
import * as ExcelJS from "exceljs";
import { PORTAL_SECTIONS, PORTAL_SECTION_GROUPS } from "@/lib/templates/portal";

const BEIGE = "FFFEF3C7";
const GRAY = "FFE5E7EB";
const GROUP_COLORS: Record<string, string> = {
  "基本情報":        "FFD1FAE5",
  "こだわりポイント": "FFDBEAFE",
  "ストーリー情報":  "FFEDE9FE",
};

function str(v: unknown): string {
  return v != null ? String(v) : "";
}

/** キーがどのグループに属するか返す */
function getGroup(key: string): string {
  for (const g of PORTAL_SECTION_GROUPS) {
    if ((g.keys as readonly string[]).includes(key)) return g.label;
  }
  return "";
}

export async function POST(req: Request) {
  const { output, projectName } = await req.json();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("ポータル情報");

  // 列幅設定（26列）
  PORTAL_SECTIONS.forEach((_, i) => {
    sheet.getColumn(i + 1).width = 22;
  });

  // 行1: グループラベル
  const groupRow = sheet.addRow(PORTAL_SECTIONS.map((key) => getGroup(key)));
  PORTAL_SECTIONS.forEach((key, i) => {
    const cell = groupRow.getCell(i + 1);
    const groupName = getGroup(key);
    cell.font = { bold: true, size: 9, color: { argb: "FF374151" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GROUP_COLORS[groupName] ?? GRAY } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { right: { style: "thin", color: { argb: "FFCBD5E1" } } };
  });
  groupRow.height = 18;

  // 行2: 項目名（ヘッダー）
  const headerRow = sheet.addRow(PORTAL_SECTIONS.map((s) => s));
  PORTAL_SECTIONS.forEach((_, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.font = { bold: true, size: 9 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRAY } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF6B7280" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });
  headerRow.height = 22;

  // 行3: 値
  const valueRow = sheet.addRow(PORTAL_SECTIONS.map((key) => str((output as Record<string, unknown>)[key])));
  PORTAL_SECTIONS.forEach((_, i) => {
    const cell = valueRow.getCell(i + 1);
    cell.font = { size: 9 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BEIGE } };
    cell.alignment = { wrapText: true, vertical: "top" };
    cell.border = { right: { style: "thin", color: { argb: "FFCBD5E1" } } };
    const val = str((output as Record<string, unknown>)[PORTAL_SECTIONS[i]]);
    const lines = val ? val.split("\n").length : 1;
    valueRow.height = Math.max(40, lines * 15);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = encodeURIComponent(`${projectName ?? "ポータル"}_情報整理.xlsx`);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`,
    },
  });
}
