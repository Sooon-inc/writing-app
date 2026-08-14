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
    if (!current || current.section !== section || c13) return;
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

function copyRow(source: ExcelJS.Row, target: ExcelJS.Row): void {
  target.height = source.height;
  source.eachCell({ includeEmpty: true }, (cell, col) => {
    const dest = target.getCell(col);
    dest.value = cloneValue(cell.value);
    dest.style = JSON.parse(JSON.stringify(cell.style));
  });
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
    sheet.spliceRows(insertAt, 0, ...Array.from({ length: blockSize }, () => []));
    for (let offset = 0; offset < blockSize; offset += 1) {
      copyRow(sheet.getRow(sourceStart + offset), sheet.getRow(insertAt + offset));
    }
    const header = sheet.getRow(insertAt);
    header.getCell(4).value = def.group;
    header.getCell(5).value = def.group;
    for (const field of fields) actualByVirtual.set(field.rn, insertAt + (field.sourceRn - def.sourceStart));
    insertedAt.push({ at: def.insertAt, count: blockSize });
  }

  const transformed: Record<string, string> = {};
  for (const [key, value] of Object.entries(rowContents)) {
    const rn = Number(key);
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
