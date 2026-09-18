import * as ExcelJS from "exceljs";

const LABEL_OR_GUIDE_FILLS = new Set([
  "FFFFFFFF", // 項目名
  "FFFFFCFC", // 項目名（ほぼ白）
  "FFF3F3F3", // 補足・画像・文字数欄
  "FF000000", // グループ見出し
  "FF434343", // 説明見出し
  "FFE20000", // 赤字の補足・価格見出し
  "FFDDDD0A", // 黄色の見出し文字
  "FFF7F2BC", // 説明エリア
]);

function masterCell(cell: ExcelJS.Cell): ExcelJS.Cell {
  return cell.isMerged && cell.master?.address !== cell.address
    ? cell.master
    : cell;
}

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "richText" in value) {
    return (value as ExcelJS.CellRichTextValue).richText
      .map((part) => part.text)
      .join("")
      .trim();
  }
  return "";
}

function fillArgb(cell: ExcelJS.Cell): string {
  const fill = cell.fill;
  if (!fill || fill.type !== "pattern") return "";
  return fill.fgColor?.argb?.toUpperCase() ?? "";
}

/** 色付きの入力欄か。白い項目名・灰色の補足欄は除外する。 */
function isInputCell(cell: ExcelJS.Cell): boolean {
  const color = fillArgb(cell);
  return Boolean(color) && !LABEL_OR_GUIDE_FILLS.has(color);
}

function findInputCellInRow(
  row: ExcelJS.Row,
  preferredCol: number
): ExcelJS.Cell | undefined {
  const preferred = masterCell(row.getCell(preferredCol));

  // 原本4種類の通常入力欄に共通して含まれるJ列を最優先する。
  // 空欄なら、白背景のテンプレートも含めて入力欄として扱える。
  if (!cellText(preferred) || isInputCell(preferred)) return preferred;

  // スタッフ紹介・採用系など、項目名がJ列まで結合されている特殊表は
  // G〜O列にある実際の色付き入力欄へ退避する。
  const seen = new Set<string>();
  for (let col = 7; col <= 15; col += 1) {
    const candidate = masterCell(row.getCell(col));
    if (seen.has(candidate.address)) continue;
    seen.add(candidate.address);
    if (isInputCell(candidate)) return candidate;
  }

  return undefined;
}

function rowLabel(row: ExcelJS.Row): string {
  return cellText(masterCell(row.getCell(5))) || cellText(masterCell(row.getCell(8)));
}

/** 縦結合セルの2行目以降を、別の生成項目として重複登録しない。 */
export function isHpFieldAnchorRow(
  row: ExcelJS.Row,
  labelColumns: number[]
): boolean {
  for (const col of labelColumns) {
    const cell = masterCell(row.getCell(col));
    if (!cellText(cell)) continue;
    return cell.fullAddress.row === row.number;
  }
  return false;
}

/**
 * HP原本の実入力セルを解決する。
 *
 * 通常は全テンプレート共通のJ列を基準にし、結合セルのmasterへ書き込む。
 * 一部の特殊表では入力欄がI/L列、または項目名の次行にあるため、原本の
 * セル色と行構造から実入力欄を特定する。見出ししかない行はundefinedにし、
 * テンプレートの項目名を生成文で上書きしない。
 */
export function resolveHpOutputCell(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  preferredCol = 10
): ExcelJS.Cell | undefined {
  const row = sheet.getRow(rowNumber);
  const sameRow = findInputCellInRow(row, preferredCol);
  if (sameRow) return sameRow;

  // 「得意なスタイル」のように、項目名の直下が入力欄の原本に対応する。
  const nextRowNumber = rowNumber + 1;
  if (nextRowNumber > sheet.rowCount) return undefined;
  const nextRow = sheet.getRow(nextRowNumber);
  if (rowLabel(nextRow)) return undefined;

  return findInputCellInRow(nextRow, preferredCol);
}
