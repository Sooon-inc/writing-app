export const DIRECTORY_OUTPUT_KEY = "__directory__";
export const DIRECTORY_ROW_BASE = 900000;
export const LP_DIRECTORY_H1_ROW = DIRECTORY_ROW_BASE + 1;
export const LP_DIRECTORY_DESCRIPTION_ROW = DIRECTORY_ROW_BASE + 2;

export interface EditableDirectoryMetadata {
  key: string;
  label: string;
  h1: string;
  description: string;
}

export interface EditableDirectoryItem extends EditableDirectoryMetadata {
  h1Row: number;
  descriptionRow: number;
}

export type DirectoryRows = Record<string, string>;

export function directoryMetadataToRows(
  metadata: EditableDirectoryMetadata[]
): DirectoryRows {
  const rows: DirectoryRows = { __count: String(metadata.length) };
  metadata.forEach((item, index) => {
    const h1Row = DIRECTORY_ROW_BASE + index * 2 + 1;
    rows[`__key_${index}`] = item.key;
    rows[`__label_${index}`] = item.label;
    rows[String(h1Row)] = item.h1;
    rows[String(h1Row + 1)] = item.description;
  });
  return rows;
}

export function directoryRowsToItems(
  rows: Record<string | number, string> | null | undefined
): EditableDirectoryItem[] {
  if (!rows) return [];
  const count = Number(rows.__count ?? 0);
  if (!Number.isFinite(count) || count <= 0) return [];

  const items: EditableDirectoryItem[] = [];
  for (let index = 0; index < count; index += 1) {
    const key = String(rows[`__key_${index}`] ?? "").trim();
    const label = String(rows[`__label_${index}`] ?? key).trim();
    if (!key || !label) continue;
    const h1Row = DIRECTORY_ROW_BASE + index * 2 + 1;
    items.push({
      key,
      label,
      h1Row,
      descriptionRow: h1Row + 1,
      h1: String(rows[h1Row] ?? rows[String(h1Row)] ?? ""),
      description: String(rows[h1Row + 1] ?? rows[String(h1Row + 1)] ?? ""),
    });
  }
  return items;
}

export function directoryRowsToMetadata(
  rows: Record<string | number, string> | null | undefined
): EditableDirectoryMetadata[] {
  return directoryRowsToItems(rows).map(({ key, label, h1, description }) => ({
    key,
    label,
    h1,
    description,
  }));
}

export function addLpDirectoryToOutput(
  output: Record<number | string, string>,
  metadata: EditableDirectoryMetadata | undefined
): Record<number | string, string> {
  if (!metadata) return output;
  return {
    ...output,
    [LP_DIRECTORY_H1_ROW]: metadata.h1,
    [LP_DIRECTORY_DESCRIPTION_ROW]: metadata.description,
  };
}

export function getLpDirectoryItem(
  output: Record<number | string, string> | null | undefined
): EditableDirectoryItem | null {
  if (!output) return null;
  const h1 = String(output[LP_DIRECTORY_H1_ROW] ?? output[String(LP_DIRECTORY_H1_ROW)] ?? "");
  const description = String(
    output[LP_DIRECTORY_DESCRIPTION_ROW] ??
    output[String(LP_DIRECTORY_DESCRIPTION_ROW)] ??
    ""
  );
  if (!h1 && !description) return null;
  return {
    key: "LP",
    label: "LP（ランディングページ）",
    h1Row: LP_DIRECTORY_H1_ROW,
    descriptionRow: LP_DIRECTORY_DESCRIPTION_ROW,
    h1,
    description,
  };
}

export function isDirectoryDataRow(rowNumber: number): boolean {
  return rowNumber > DIRECTORY_ROW_BASE;
}
