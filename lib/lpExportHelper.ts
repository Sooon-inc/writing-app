import * as ExcelJS from "exceljs";
import {
  LP_DIRECTORY_DESCRIPTION_ROW,
  LP_DIRECTORY_H1_ROW,
  isDirectoryDataRow,
} from "@/lib/directoryOutput";

export function applyLpOutputsToWorkbook(
  wb: ExcelJS.Workbook,
  lpRows: Record<string, string>
): void {
  const lpSheet = wb.getWorksheet("LP");
  if (!lpSheet) throw new Error("LP sheet not found in template");

  for (const [rowNumStr, value] of Object.entries(lpRows)) {
    if (!value) continue;
    const rowNum = Number(rowNumStr);
    if (!Number.isInteger(rowNum) || isDirectoryDataRow(rowNum)) continue;
    lpSheet.getRow(rowNum).getCell(10).value = value;
  }

  const directorySheet =
    wb.getWorksheet("【ディレクトリ】") ??
    wb.worksheets.find((sheet) => sheet.name.includes("ディレクトリ"));
  if (!directorySheet) return;

  const h1 = lpRows[String(LP_DIRECTORY_H1_ROW)] ?? "";
  const description = lpRows[String(LP_DIRECTORY_DESCRIPTION_ROW)] ?? "";
  directorySheet.getRow(4).getCell(10).value = h1;
  directorySheet.getRow(4).getCell(14).value = description;
}
