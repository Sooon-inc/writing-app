import * as ExcelJS from "exceljs";

export interface HpSitemapItem {
  id: string;
  sheetName: string;
}

/** Excelシート名として使える文字列に変換（最大31文字、使用不可文字を除去） */
function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, "_").slice(0, 31).trim() || "ページ";
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
      dstCell.value = srcCell.value;
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
  for (const [rowNumStr, value] of Object.entries(rowContents)) {
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
  fixedSheetColMap?: Record<string, number>
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
}
