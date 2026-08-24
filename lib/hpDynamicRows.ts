import * as ExcelJS from "exceljs";

export type HpDynamicField = {
  rn: number;
  sourceRn: number;
  section: string;
  group: string;
  label: string;
  condition: string;
  insertAt: number;
  sourceStart: number;
  sourceEnd: number;
  extraIndex: number;
};

function text(row: ExcelJS.Row, col: number): string {
  const value = row.getCell(col).value;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object" && "richText" in value) {
    return (value as ExcelJS.CellRichTextValue).richText.map((part) => part.text).join("").trim();
  }
  return "";
}

const KANJI = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十"];
function groupName(index: number): string {
  return `${KANJI[index] || String(index)}つ目`;
}

/** 繰り返しグループが2件以上あるセクションに、合計20件までの追加枠を作る。 */
export function buildHpDynamicFields(sheet: ExcelJS.Worksheet): HpDynamicField[] {
  type Group = { name: string; header: number; section: string; fields: Array<{ rn: number; label: string; condition: string }> };
  const groups: Group[] = [];
  let section = "";
  let current: Group | undefined;

  sheet.eachRow((row, rn) => {
    if (rn <= 4) return;
    const nextSection = text(row, 2).split("\n")[0].trim();
    if (nextSection) section = nextSection;
    const c4 = text(row, 4);
    const c5 = text(row, 5);
    const c8 = text(row, 8);
    const c13 = text(row, 13);
    if (c13 === "-") {
      current = { name: c5 || c4, header: rn, section, fields: [] };
      groups.push(current);
      return;
    }
    if (!current || current.section !== section) return;
    // 「/」等が入るリンク先行も繰り返しブロックの一部。これを除外すると
    // 追加サービスのリンク先だけシートへ書き出されない。
    if (c13 && c13 !== "/") return;
    const label = c5 || c8;
    if (!label || label === "項目・要素" || label === section || label.includes("完成理想")) return;
    current.fields.push({ rn, label, condition: c4 });
  });

  const result: HpDynamicField[] = [];
  const bySection = new Map<string, Group[]>();
  for (const group of groups) {
    if (!group.name || group.fields.length === 0) continue;
    const list = bySection.get(group.section) ?? [];
    list.push(group);
    bySection.set(group.section, list);
  }

  let sectionIndex = 0;
  for (const [sectionName, sectionGroups] of bySection) {
    if (sectionGroups.length < 2) continue;
    const signatures = sectionGroups.map((group) => group.fields.map((field) => field.label).join("\u0000"));
    if (new Set(signatures).size !== 1) continue;
    sectionIndex += 1;
    const source = sectionGroups[sectionGroups.length - 1];
    const nextSectionRow = (() => {
      for (let rn = source.header + 1; rn <= sheet.rowCount; rn += 1) {
        const value = text(sheet.getRow(rn), 2).split("\n")[0].trim();
        if (value && value !== sectionName) return rn;
      }
      return sheet.rowCount + 1;
    })();
    const sourceEnd = nextSectionRow - 1;
    for (let ordinal = sectionGroups.length + 1; ordinal <= 20; ordinal += 1) {
      const extraIndex = ordinal - sectionGroups.length;
      source.fields.forEach((field, fieldIndex) => {
        result.push({
          rn: 200000 + sectionIndex * 10000 + extraIndex * 100 + fieldIndex,
          sourceRn: field.rn,
          section: sectionName,
          group: groupName(ordinal),
          label: field.label,
          condition: field.condition,
          insertAt: nextSectionRow,
          sourceStart: source.header,
          sourceEnd,
          extraIndex,
        });
      });
    }
  }
  return result;
}

function cloneValue(value: ExcelJS.CellValue): ExcelJS.CellValue {
  if (!value || typeof value !== "object") return value;
  if (value instanceof Date) return new Date(value);
  return JSON.parse(JSON.stringify(value)) as ExcelJS.CellValue;
}

type MergeRange = { top: number; left: number; bottom: number; right: number };

function mergeRanges(sheet: ExcelJS.Worksheet): MergeRange[] {
  // ExcelJSは結合一覧を公開APIで返さないため、読み込み済みのモデルを使う。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const merges = Object.values((sheet as any)._merges ?? {}) as Array<{ model: MergeRange }>;
  return merges.map((merge) => ({ ...merge.model }));
}

function rangeAddress(range: MergeRange): string {
  const col = (value: number) => {
    let result = "";
    for (let n = value; n > 0; n = Math.floor((n - 1) / 26)) {
      result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
    }
    return result;
  };
  return `${col(range.left)}${range.top}:${col(range.right)}${range.bottom}`;
}

type RowSnapshot = {
  height?: number;
  cells: Array<{ col: number; value: ExcelJS.CellValue; style: Partial<ExcelJS.Style> }>;
};

function snapshotRows(sheet: ExcelJS.Worksheet, start: number, end: number): RowSnapshot[] {
  const rows: RowSnapshot[] = [];
  for (let rn = start; rn <= end; rn += 1) {
    const row = sheet.getRow(rn);
    const cells: RowSnapshot["cells"] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const isMergeSlave = cell.isMerged && cell.master?.address !== cell.address;
      cells.push({
        col,
        // 結合スレーブはmasterの値を返すため、複製するとD〜Gなど
        // 全セルに同じ文字が展開される。値はmasterだけ保持する。
        value: isMergeSlave ? null : cloneValue(cell.value),
        style: JSON.parse(JSON.stringify(cell.style)),
      });
    });
    rows.push({ height: row.height, cells });
  }
  return rows;
}

function insertClonedBlock(
  sheet: ExcelJS.Worksheet,
  sourceStart: number,
  sourceEnd: number,
  insertAt: number
): void {
  const count = sourceEnd - sourceStart + 1;
  const rows = snapshotRows(sheet, sourceStart, sourceEnd);
  const merges = mergeRanges(sheet);

  // spliceRowsは結合セルがある場合の挿入を安定して扱えない。
  // 一度解除し、挿入後に元の結合と複製ブロックの結合を再構築する。
  for (const merge of merges) sheet.unMergeCells(rangeAddress(merge));
  sheet.spliceRows(insertAt, 0, ...Array.from({ length: count }, () => []));

  rows.forEach((snapshot, offset) => {
    const row = sheet.getRow(insertAt + offset);
    if (snapshot.height != null) row.height = snapshot.height;
    for (const cell of snapshot.cells) {
      const target = row.getCell(cell.col);
      target.value = cell.value;
      target.style = cell.style;
    }
  });

  for (const merge of merges) {
    const shifted = { ...merge };
    if (merge.top >= insertAt) {
      shifted.top += count;
      shifted.bottom += count;
    } else if (
      merge.bottom >= insertAt ||
      // 挿入点の直前で終わるセクション名の縦結合は、追加グループも
      // 同じセクションに含むため下端を延長する。
      (merge.bottom === insertAt - 1 && merge.top < sourceStart)
    ) {
      // セクション全体をまたぐ縦結合は、追加行分だけ下端を延ばす。
      shifted.bottom += count;
    }
    sheet.mergeCells(rangeAddress(shifted));
  }

  for (const merge of merges) {
    if (merge.top < sourceStart || merge.bottom > sourceEnd) continue;
    sheet.mergeCells(rangeAddress({
      top: insertAt + merge.top - sourceStart,
      bottom: insertAt + merge.bottom - sourceStart,
      left: merge.left,
      right: merge.right,
    }));
  }
}

/** 仮想行を同じセクション末尾の実行に変換し、書式付きで行を挿入する。 */
export function prepareHpDynamicRows(
  sheet: ExcelJS.Worksheet,
  rowContents: Record<string, string>
): Record<string, string> {
  const definitions = buildHpDynamicFields(sheet);
  const byRn = new Map(definitions.map((field) => [field.rn, field]));
  const used = definitions.filter((field) => rowContents[String(field.rn)] != null && rowContents[String(field.rn)] !== "");
  if (used.length === 0) return rowContents;

  const staleLinkRows = new Set<number>();
  for (const field of used) {
    const sourceEnd = field.sourceEnd;
    const sourceLabel = `${text(sheet.getRow(sourceEnd), 5)} ${text(sheet.getRow(sourceEnd), 8)}`;
    const stored = String(rowContents[String(sourceEnd)] ?? "").trim();
    if (
      sourceLabel.includes("リンク先") &&
      stored &&
      !/^(?:\/|https?:\/\/|#|mailto:|tel:)/i.test(stored)
    ) {
      // 旧仕様で次の見出しが「リンク先」行へ漏れたデータを出力しない。
      staleLinkRows.add(sourceEnd);
    }
  }

  const groups = new Map<string, HpDynamicField[]>();
  for (const field of used) {
    const key = `${field.section}\u0000${field.extraIndex}`;
    if (!groups.has(key)) groups.set(key, definitions.filter((item) => item.section === field.section && item.extraIndex === field.extraIndex));
  }

  const actualByVirtual = new Map<number, number>();
  const insertedAt: Array<{ at: number; count: number }> = [];
  const ordered = [...groups.values()].sort((a, b) => a[0].insertAt - b[0].insertAt || a[0].extraIndex - b[0].extraIndex);
  for (const fields of ordered) {
    const def = fields[0];
    const blockSize = def.sourceEnd - def.sourceStart + 1;
    const sourceShift = insertedAt.filter((item) => item.at <= def.sourceStart).reduce((sum, item) => sum + item.count, 0);
    const insertShift = insertedAt.filter((item) => item.at <= def.insertAt).reduce((sum, item) => sum + item.count, 0);
    const sourceStart = def.sourceStart + sourceShift;
    const insertAt = def.insertAt + insertShift;
    insertClonedBlock(sheet, sourceStart, sourceStart + blockSize - 1, insertAt);
    const header = sheet.getRow(insertAt);
    header.getCell(4).value = def.group;
    header.getCell(5).value = def.group;
    for (const field of fields) actualByVirtual.set(field.rn, insertAt + (field.sourceRn - def.sourceStart));
    insertedAt.push({ at: def.insertAt, count: blockSize });
  }

  const transformed: Record<string, string> = {};
  for (const [key, value] of Object.entries(rowContents)) {
    const rn = Number(key);
    if (staleLinkRows.has(rn)) continue;
    if (byRn.has(rn)) {
      const actual = actualByVirtual.get(rn);
      if (actual) transformed[String(actual)] = value;
      continue;
    }
    const shift = insertedAt.filter((item) => rn >= item.at).reduce((sum, item) => sum + item.count, 0);
    transformed[String(rn + shift)] = value;
  }
  return transformed;
}

export function hpDynamicRowsPrompt(pageKey: string, fields: HpDynamicField[]): string {
  if (fields.length === 0) return "";
  const lines = fields.map((field) => `${field.rn}=[${field.section}] ${field.group}/${field.label}`);
  return [
    `【${pageKey}：同一セクション内の追加行】`,
    "ユーザーが指定したセクションに項目を追加する場合は、下記の仮想行を必要数分使うこと。別のセクションの行に絶対に書かない。",
    "例：既存5件を10件にする場合は、6つ目〜10つ目の各項目をdiffに含める。",
    ...lines,
  ].join("\n");
}
