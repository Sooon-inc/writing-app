import * as ExcelJS from "exceljs";

export const BEAUTY_TOP_SECTION04_EXTRA_FIELDS = [
  { rn: 10046, sourceRn: 46, section: "セクション.04", group: "四つ目", label: "欧文飾り文字" },
  { rn: 10047, sourceRn: 47, section: "セクション.04", group: "四つ目", label: "欧文見出し" },
  { rn: 10048, sourceRn: 48, section: "セクション.04", group: "四つ目", label: "日本語見出し" },
  { rn: 10049, sourceRn: 49, section: "セクション.04", group: "四つ目", label: "写真下 ＞ 中見出し" },
  { rn: 10050, sourceRn: 50, section: "セクション.04", group: "四つ目", label: "写真下 ＞ 本文" },
] as const;

const BEAUTY_TOP_SECTION04_EXTRA_INSERT_AT = 52;
const BEAUTY_TOP_SECTION04_EXTRA_SOURCE_HEADER_ROW = 45;
const BEAUTY_TOP_SECTION04_EXTRA_ROW_COUNT = 7;
const BEAUTY_TOP_SECTION04_EXTRA_VIRTUAL_ROW_MIN = 10046;
const BEAUTY_TOP_SECTION04_EXTRA_VIRTUAL_ROW_MAX = 10051;
const BEAUTY_TOP_SECTION04_EXTRA_VIRTUAL_TO_SOURCE_ROW: Record<number, number> = {
  10046: 46,
  10047: 47,
  10048: 48,
  10049: 49,
  10050: 50,
  10051: 51,
};

export function isBeautyTopSheet(projectType: string, sheetName: string): boolean {
  return projectType === "hp-beauty" && sheetName.trim() === "トップ";
}

export function hasBeautyTopSection04ExtraRows(rowContents: Record<string, string>): boolean {
  return Object.keys(rowContents).some((rowNumStr) => {
    const rowNum = parseInt(rowNumStr);
    return rowNum >= BEAUTY_TOP_SECTION04_EXTRA_VIRTUAL_ROW_MIN &&
      rowNum <= BEAUTY_TOP_SECTION04_EXTRA_VIRTUAL_ROW_MAX;
  });
}

function cloneCellValue(value: ExcelJS.CellValue): ExcelJS.CellValue {
  if (!value || typeof value !== "object") return value;
  if (value instanceof Date) return new Date(value);
  return JSON.parse(JSON.stringify(value)) as ExcelJS.CellValue;
}

function copyRow(source: ExcelJS.Row, target: ExcelJS.Row): void {
  if (source.height) target.height = source.height;
  source.eachCell({ includeEmpty: true }, (sourceCell, colNumber) => {
    const targetCell = target.getCell(colNumber);
    targetCell.value = cloneCellValue(sourceCell.value);
    targetCell.style = JSON.parse(JSON.stringify(sourceCell.style));
    if (sourceCell.numFmt) targetCell.numFmt = sourceCell.numFmt;
  });
  target.commit();
}

function insertBeautyTopSection04FourthBlock(sheet: ExcelJS.Worksheet): void {
  sheet.spliceRows(
    BEAUTY_TOP_SECTION04_EXTRA_INSERT_AT,
    0,
    ...Array.from({ length: BEAUTY_TOP_SECTION04_EXTRA_ROW_COUNT }, () => [])
  );

  for (let offset = 0; offset < BEAUTY_TOP_SECTION04_EXTRA_ROW_COUNT; offset += 1) {
    const sourceRow = sheet.getRow(BEAUTY_TOP_SECTION04_EXTRA_SOURCE_HEADER_ROW + offset);
    const targetRow = sheet.getRow(BEAUTY_TOP_SECTION04_EXTRA_INSERT_AT + offset);
    copyRow(sourceRow, targetRow);
  }

  const headerRow = sheet.getRow(BEAUTY_TOP_SECTION04_EXTRA_INSERT_AT);
  headerRow.getCell(4).value = "四つ目";
  headerRow.getCell(5).value = "四つ目";
  headerRow.commit();
}

export function prepareBeautyTopSection04ExtraRows(
  sheet: ExcelJS.Worksheet,
  rowContents: Record<string, string>
): Record<string, string> {
  if (!hasBeautyTopSection04ExtraRows(rowContents)) return rowContents;

  insertBeautyTopSection04FourthBlock(sheet);

  const transformed: Record<string, string> = {};
  for (const [rowNumStr, value] of Object.entries(rowContents)) {
    const rowNum = parseInt(rowNumStr);
    if (!Number.isFinite(rowNum)) continue;

    const sourceRow = BEAUTY_TOP_SECTION04_EXTRA_VIRTUAL_TO_SOURCE_ROW[rowNum];
    if (sourceRow) {
      const actualRow = BEAUTY_TOP_SECTION04_EXTRA_INSERT_AT +
        (sourceRow - BEAUTY_TOP_SECTION04_EXTRA_SOURCE_HEADER_ROW);
      transformed[String(actualRow)] = value;
      continue;
    }

    if (
      rowNum >= BEAUTY_TOP_SECTION04_EXTRA_INSERT_AT &&
      rowNum < BEAUTY_TOP_SECTION04_EXTRA_VIRTUAL_ROW_MIN
    ) {
      transformed[String(rowNum + BEAUTY_TOP_SECTION04_EXTRA_ROW_COUNT)] = value;
    } else {
      transformed[rowNumStr] = value;
    }
  }

  return transformed;
}

export function beautyTopSection04ExtraPrompt(pageKey: string): string {
  return [
    "【ビューティーTOP セクション.04の追加行ルール】",
    "セクション.04に4つ目を追加する場合は、既存行番号ではなく以下の仮想行番号を使ってupdate JSONを返すこと。",
    `例: {"${pageKey}": {"10046": "欧文飾り文字", "10047": "欧文見出し", "10048": "日本語見出し", "10049": "写真下 ＞ 中見出し", "10050": "写真下 ＞ 本文"}}`,
    "10046=四つ目/欧文飾り文字、10047=四つ目/欧文見出し、10048=四つ目/日本語見出し、10049=四つ目/写真下 ＞ 中見出し、10050=四つ目/写真下 ＞ 本文。",
  ].join("\n");
}
