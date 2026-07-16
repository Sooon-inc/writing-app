import * as ExcelJS from "exceljs";
import {
  hasBeautyTopSection04ExtraRows,
  prepareBeautyTopSection04ExtraRows,
} from "@/lib/hpExtraRows";
import type { DirectoryMetadata } from "@/lib/hpDirectoryMetadata";

export interface HpSitemapItem {
  id: string;
  sheetName: string;
}

/** Excelシート名として使える文字列に変換（最大31文字、使用不可文字を除去） */
function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, "_").slice(0, 31).trim() || "ページ";
}

/**
 * ワークシート複製用にセル値をコピーする。
 *
 * Excel の共有数式（sharedFormula）をそのまま別シートへコピーすると、
 * コピー先には共有数式の親セルが存在しない状態になることがある。
 * Google スプレッドシートへの変換時に
 * "Shared Formula master must exist above and or left of clone" となるため、
 * 数式は各セルごとの通常数式として書き出す。
 */
function cloneCellValue(sourceCell: ExcelJS.Cell): ExcelJS.CellValue {
  if (sourceCell.type === ExcelJS.ValueType.Formula) {
    let formula: string | undefined;
    try {
      formula = sourceCell.formula;
    } catch {
      // 共有数式の親セルが欠けたセルは式を展開できない。
      // 補助用の計算セルなので、キャッシュ値を引き継いで出力を継続する。
      return sourceCell.result ?? null;
    }
    if (formula) {
      return {
        formula,
        // キャッシュ値も残し、Excel / Google Sheets が再計算するまでの表示を保つ。
        result: sourceCell.result,
      } as ExcelJS.CellFormulaValue;
    }

    return sourceCell.result ?? null;
  }

  return sourceCell.value;
}

/**
 * Google スプレッドシート変換用に、ブック内の共有数式をすべて通常数式へ変換する。
 *
 * 元テンプレートに残っている共有数式も、追加ページ複製後に親セルとの関連が
 * 不正になることがある。シートを削除した後にまとめて正規化することで、
 * 出力ブック内に sharedFormula を残さない。
 */
function normalizeWorkbookFormulas(wb: ExcelJS.Workbook): void {
  const formulas: Array<{
    cell: ExcelJS.Cell;
    formula: string | undefined;
    result: ExcelJS.CellValue;
  }> = [];

  for (const sheet of wb.worksheets) {
    sheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (cell.type !== ExcelJS.ValueType.Formula) return;
        // 先に全セルの式を取得する。共有数式の親を上書きした後では、
        // クローン側の式を復元できなくなるため。
        let formula: string | undefined;
        try {
          formula = cell.formula;
        } catch {
          // 共有数式の親が存在しない補助セルは、式ではなくキャッシュ値として
          // 保存する。Google Sheets への変換を止めないことを優先する。
          formula = undefined;
        }
        formulas.push({
          cell,
          formula,
          result: cell.result,
        });
      });
    });
  }

  for (const { cell, formula, result } of formulas) {
    cell.value = formula
      ? ({ formula, result } as ExcelJS.CellFormulaValue)
      : result ?? null;
  }
}

function normalizedDirectoryLabel(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/^【option】/, "")
    .replace(/[・･\s]/g, "")
    .replace(/（一覧）/g, "")
    .replace(/紹介/g, "")
    .trim();
}

function copyRowStyle(source: ExcelJS.Row, destination: ExcelJS.Row): void {
  destination.height = source.height;
  for (let col = 1; col <= source.worksheet.columnCount; col += 1) {
    const sourceCell = source.getCell(col);
    const destinationCell = destination.getCell(col);
    if (sourceCell.style) {
      destinationCell.style = JSON.parse(JSON.stringify(sourceCell.style));
    }
  }
}

/** 生成済みページだけをディレクトリシートへ反映する。 */
function applyDirectoryMetadata(
  wb: ExcelJS.Workbook,
  metadata: DirectoryMetadata[]
): void {
  if (metadata.length === 0) return;
  const sheet = wb.worksheets.find((item) => item.name.includes("ディレクトリ"));
  if (!sheet) return;

  const usedRows = new Set<number>();
  const findMatchingRow = (label: string): number | undefined => {
    const normalized = normalizedDirectoryLabel(label);
    for (let rowNumber = 4; rowNumber <= sheet.rowCount; rowNumber += 1) {
      if (usedRows.has(rowNumber)) continue;
      const row = sheet.getRow(rowNumber);
      const dLabel = String(row.getCell(4).value ?? "");
      const topLabel = String(row.getCell(2).value ?? "");
      const candidate = dLabel || (topLabel === "トップ" ? topLabel : "");
      if (
        candidate &&
        normalizedDirectoryLabel(candidate) === normalized
      ) {
        return rowNumber;
      }
    }
    return undefined;
  };

  const blankReservedRows = (): number[] => {
    const rows: number[] = [];
    for (let rowNumber = 4; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const hasPageNumber = Number(row.getCell(1).value) > 0;
      const hasPageLabel = [2, 3, 4, 5].some(
        (col) => String(row.getCell(col).value ?? "").trim()
      );
      if (hasPageNumber && !hasPageLabel && !usedRows.has(rowNumber)) {
        rows.push(rowNumber);
      }
    }
    return rows;
  };

  const nextPageNumber = () => {
    let max = 0;
    for (let rowNumber = 4; rowNumber <= sheet.rowCount; rowNumber += 1) {
      max = Math.max(max, Number(sheet.getRow(rowNumber).getCell(1).value) || 0);
    }
    return max + 1;
  };

  const appendPageRow = (label: string): number => {
    const reserved = blankReservedRows()[0];
    if (reserved) {
      sheet.getRow(reserved).getCell(4).value = label;
      return reserved;
    }

    let insertAt = sheet.rowCount + 1;
    for (let rowNumber = 4; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      if (
        !row.getCell(1).value &&
        ([6, 7].some((col) => row.getCell(col).value === 0))
      ) {
        insertAt = rowNumber;
        break;
      }
    }

    sheet.insertRow(insertAt, []);
    const sourceRow = sheet.getRow(Math.max(4, insertAt - 1));
    const row = sheet.getRow(insertAt);
    copyRowStyle(sourceRow, row);
    row.getCell(1).value = nextPageNumber();
    row.getCell(4).value = label;

    // テンプレートの進捗列を実際のチェックボックス対象として保持する。
    for (const col of [6, 7]) {
      const hasBooleanColumn = sheet
        .getColumn(col)
        .values.some((value) => typeof value === "boolean");
      if (hasBooleanColumn) row.getCell(col).value = false;
    }
    return insertAt;
  };

  const duplicateCounts = new Map<string, number>();
  for (const item of metadata) {
    const normalized = normalizedDirectoryLabel(item.label);
    const duplicateNo = (duplicateCounts.get(normalized) ?? 0) + 1;
    duplicateCounts.set(normalized, duplicateNo);
    const displayLabel = duplicateNo === 1
      ? item.label
      : `${item.label}（${duplicateNo}）`;
    const rowNumber = findMatchingRow(item.label) ?? appendPageRow(displayLabel);
    const row = sheet.getRow(rowNumber);
    row.getCell(10).value = item.h1;
    row.getCell(14).value = item.description;
    usedRows.add(rowNumber);
  }

  sheet.getCell("D1").value = nextPageNumber() - 1;
}

/** ワークシートを複製して新しい名前で追加 */
function cloneWorksheet(
  wb: ExcelJS.Workbook,
  source: ExcelJS.Worksheet,
  newName: string
): ExcelJS.Worksheet {
  const dest = wb.addWorksheet(newName);

  // 列幅コピー
  source.columns.forEach((col) => {
    if (col.number) {
      const dstCol = dest.getColumn(col.number);
      if (col.width) dstCol.width = col.width;
    }
  });

  // セル結合をコピー（値書き込み前に実行する必要がある）
  // ExcelJS 4.x の内部 _merges: Record<string, { tl: string; br: string }>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const merges = (source as any)._merges as Record<string, { tl: string; br: string }> | undefined;
  if (merges) {
    for (const range of Object.values(merges)) {
      try {
        dest.mergeCells(`${range.tl}:${range.br}`);
      } catch { /* ignore */ }
    }
  }

  // 行・セルをコピー
  source.eachRow({ includeEmpty: true }, (srcRow, rowNum) => {
    const dstRow = dest.getRow(rowNum);
    if (srcRow.height) dstRow.height = srcRow.height;

    srcRow.eachCell({ includeEmpty: true }, (srcCell) => {
      // 結合スレーブセルはスキップ（マスターで処理済み）
      if (srcCell.isMerged && srcCell.master && srcCell.master.address !== srcCell.address) return;

      const dstCell = dstRow.getCell(srcCell.col);
      dstCell.value = cloneCellValue(srcCell);
      if (srcCell.font) dstCell.font = { ...srcCell.font };
      if (srcCell.fill) dstCell.fill = JSON.parse(JSON.stringify(srcCell.fill)) as ExcelJS.Fill;
      if (srcCell.border) dstCell.border = JSON.parse(JSON.stringify(srcCell.border));
      if (srcCell.alignment) dstCell.alignment = { ...srcCell.alignment };
      if (srcCell.numFmt) dstCell.numFmt = srcCell.numFmt;
    });
    dstRow.commit();
  });

  return dest;
}

/** 指定列に生成コンテンツを書き込む */
function writeContent(
  sheet: ExcelJS.Worksheet,
  rowContents: Record<string, string>,
  colIndex: number
): void {
  const contents = sheet.name.trim() === "トップ" && hasBeautyTopSection04ExtraRows(rowContents)
    ? prepareBeautyTopSection04ExtraRows(sheet, rowContents)
    : rowContents;

  for (const [rowNumStr, value] of Object.entries(contents)) {
    if (!value) continue;
    const rowNum = parseInt(rowNumStr);
    const row = sheet.getRow(rowNum);
    const cell = row.getCell(colIndex);
    const target =
      cell.isMerged && cell.master?.address !== cell.address ? cell.master : cell;
    target.value = value;
    row.commit();
  }
}

/**
 * hpPageOutputs をワークブックに適用する。
 * - 固定ページ: 元のシートに直接書き込む
 * - 任意ページ: 元のシートを複製し、シート名をテーマ名（未設定時はページ名）にする
 * - 複製元になったオプションシートは最後に削除する
 * @param fixedSheetColMap 固定ページのシート名ごとに書き込み列を上書きするマップ（省略時はデフォルト列8=H）
 */
export function applyHpOutputsToWorkbook(
  wb: ExcelJS.Workbook,
  hpPageOutputs: Record<string, Record<string, string>>,
  sitemapItems: HpSitemapItem[],
  pageThemes: Record<string, string>,
  fixedSheetColMap?: Record<string, number>,
  directoryMetadata: DirectoryMetadata[] = []
): void {
  const findSheet = (name: string) =>
    wb.getWorksheet(name) ??
    wb.worksheets.find((s) => s.name.trim() === name.trim());

  // instanceKey(item.id) → originalSheetName のマッピング（任意ページのみ）
  const instanceToSheet: Record<string, string> = {};
  for (const item of sitemapItems) {
    if (item.id && item.sheetName) instanceToSheet[item.id] = item.sheetName;
  }

  const usedFinalNames = new Set<string>(); // 重複回避用
  const directWritten = new Set<string>();  // 固定ページとして直接書き込んだ元シート名
  const cloneSources = new Set<string>();   // 複製元として使った任意ページのシート名

  for (const [key, rowContents] of Object.entries(hpPageOutputs)) {
    const originalSheetName = instanceToSheet[key] ?? key;
    const isOptional = key in instanceToSheet;
    const theme = pageThemes[key] ?? "";

    if (isOptional) {
      // シート名: テーマが設定されていればテーマ名、なければ元シート名
      let targetName = sanitizeSheetName(theme || originalSheetName);
      // 同名衝突回避
      if (usedFinalNames.has(targetName)) {
        let n = 2;
        while (usedFinalNames.has(`${targetName}_${n}`)) n++;
        targetName = `${targetName}_${n}`;
      }
      usedFinalNames.add(targetName);

      const originalSheet = findSheet(originalSheetName);
      if (!originalSheet) continue;

      if (targetName === originalSheetName) {
        // 名前が変わらない場合はシートが既に存在するため複製せず直接書き込む
        writeContent(originalSheet, rowContents, 10);
      } else {
        cloneSources.add(originalSheetName);
        const cloned = cloneWorksheet(wb, originalSheet, targetName);
        writeContent(cloned, rowContents, 10); // 追加ページは J 列（列10）
      }
    } else {
      // 固定ページ: 元のシートに直接書き込む
      const sheet = findSheet(originalSheetName);
      if (!sheet) continue;
      directWritten.add(originalSheetName);
      usedFinalNames.add(originalSheetName);
      const fixedCol = fixedSheetColMap?.[originalSheetName] ?? 8; // デフォルト H 列（列8）
      writeContent(sheet, rowContents, fixedCol);
    }
  }

  // 複製元として使われたオプションシートを削除（固定ページとして使われていないもの）
  for (const sheetName of cloneSources) {
    if (!directWritten.has(sheetName)) {
      const sheet = findSheet(sheetName);
      if (sheet) wb.removeWorksheet(sheet.id);
    }
  }

  applyDirectoryMetadata(wb, directoryMetadata);
  normalizeWorkbookFormulas(wb);
}
