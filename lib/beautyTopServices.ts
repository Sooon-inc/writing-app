export interface BeautySitemapItem {
  id: string;
  sheetName: string;
}

type PageRows = Record<string | number, string>;
type HpOutputs = Record<string, PageRows>;

const BASE_ROW_STARTS = [32, 39, 46];
const SERVICE_FIELD_OFFSETS = {
  decoration: 0,
  english: 1,
  japanese: 2,
  heading: 3,
  body: 4,
  link: 5,
} as const;

function value(rows: PageRows, row: number): string {
  return String(rows[row] ?? rows[String(row)] ?? "").trim();
}

function serviceSourceRows(sheetName: string) {
  if (sheetName.includes("（C型）")) {
    return { japanese: 9, english: 10, heading: 13, body: 14 };
  }
  if (sheetName.includes("（B型）")) {
    return { japanese: 9, english: 10, heading: 12, body: 13 };
  }
  return { japanese: 5, english: 6, heading: 8, body: 9 };
}

function pathFromEnglish(english: string, index: number): string {
  const slug = english
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `/service/${slug || `service-${index + 1}`}`;
}

function targetRows(index: number): number[] {
  if (index < BASE_ROW_STARTS.length) {
    const start = BASE_ROW_STARTS[index];
    return Array.from({ length: 6 }, (_, offset) => start + offset);
  }
  const extraIndex = index - BASE_ROW_STARTS.length + 1;
  const virtualStart = 200000 + 10000 + extraIndex * 100;
  return Array.from({ length: 6 }, (_, offset) => virtualStart + offset);
}

/**
 * Beautyの追加サービスページを、サイトマップ順でTOPセクション04へ同期する。
 * 既存3枠を超える分はhpDynamicRowsが実シート上の追加行へ変換する仮想行を使う。
 */
export function syncBeautyTopSection04(
  projectType: string,
  outputs: HpOutputs,
  sitemapItems: BeautySitemapItem[],
  pageThemes: Record<string, string>
): HpOutputs {
  if (projectType !== "hp-beauty" || !outputs["トップ"]) return outputs;

  const services = sitemapItems.filter((item) =>
    item.id && item.sheetName.includes("サービス紹介") && outputs[item.id]
  );
  if (services.length === 0) return outputs;

  const top = { ...outputs["トップ"] };
  // 過去の同期内容をいったん除去し、現在のサービス件数・順番で再構成する。
  for (const start of BASE_ROW_STARTS) {
    for (let offset = 0; offset < 6; offset += 1) delete top[start + offset];
  }
  for (const key of Object.keys(top)) {
    const rn = Number(key);
    if (rn >= 210100 && rn <= 211799) delete top[key];
  }

  services.forEach((item, index) => {
    const rows = outputs[item.id];
    const source = serviceSourceRows(item.sheetName);
    const japanese = pageThemes[item.id]?.trim() || value(rows, source.japanese);
    const english = value(rows, source.english);
    const heading = value(rows, source.heading) || japanese;
    const body = value(rows, source.body);
    const targets = targetRows(index);
    const values = [
      String(index + 1).padStart(2, "0"),
      english,
      japanese,
      heading,
      body,
      pathFromEnglish(english, index),
    ];
    values.forEach((content, offset) => {
      top[targets[offset]] = content;
    });
  });

  return { ...outputs, "トップ": top };
}
