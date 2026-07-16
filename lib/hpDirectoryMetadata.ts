import { jsonrepair } from "jsonrepair";
import { generateWriting } from "@/lib/claude";
import { HP_SITEMAPS } from "@/lib/hpSitemap";

export interface DirectoryMetadata {
  key: string;
  label: string;
  h1: string;
  description: string;
}

type SitemapItem = {
  id: string;
  sheetName: string;
};

export type DirectoryPageInput = {
  key: string;
  label: string;
  theme: string;
  content: string;
};

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function lengthOf(value: string): number {
  return Array.from(value).length;
}

function truncate(value: string, maxLength: number): string {
  return Array.from(value).slice(0, maxLength).join("");
}

function fitH1(
  generated: string,
  label: string,
  projectName: string
): string {
  let value = cleanText(generated) || `${projectName}の${label}`;
  if (lengthOf(value) > 35) return truncate(value, 35);
  const original = value;

  const shortBrand = cleanText(projectName).replace(
    /^(株式会社|有限会社|合同会社|合資会社|一般社団法人|一般財団法人)/,
    ""
  );
  const suffix = shortBrand && value.includes(shortBrand)
    ? `｜${label}ページ`
    : `｜${shortBrand || projectName}`;

  if (lengthOf(value) < 30) {
    value = `${value}${suffix}`;
  }
  if (lengthOf(value) < 30) {
    value = `${value}公式サイト`;
  }
  if (lengthOf(value) < 30) {
    value = `${value}｜${label}をご案内`;
  }

  if (lengthOf(value) <= 35) return value;

  // 末尾の意味が途中で切れないよう、追加部分を残して元の見出し側を縮める。
  const appended = Array.from(value).slice(lengthOf(original)).join("");
  const available = Math.max(1, 35 - lengthOf(appended));
  return `${truncate(original, available)}${appended}`;
}

function fitDescription(generated: string, fallback: string): string {
  const generatedText = cleanText(generated);
  const fallbackText = cleanText(fallback);
  const value =
    lengthOf(generatedText) >= 100 || generatedText.length >= fallbackText.length
      ? generatedText
      : fallbackText;
  return truncate(value, 120);
}

function collectDirectoryPages(
  projectType: string,
  hpPageOutputs: Record<string, Record<string, string>>,
  sitemapItems: SitemapItem[],
  pageThemes: Record<string, string>
): DirectoryPageInput[] {
  const sitemapConfig = HP_SITEMAPS[projectType] ?? [];
  const optionalSheetByKey = new Map(
    sitemapItems
      .filter((item) => item.id && item.sheetName)
      .map((item) => [item.id, item.sheetName.trim()])
  );

  const pages: DirectoryPageInput[] = [];
  for (const [key, rowContents] of Object.entries(hpPageOutputs)) {
    const optionalSheetName = optionalSheetByKey.get(key);
    const fixedConfig = sitemapConfig.find(
      (page) =>
        page.fixed &&
        page.sheetName?.trim() === key.trim()
    );

    // 現在のサイトマップに存在しない、過去の生成データは対象外。
    if (!optionalSheetName && !fixedConfig) continue;

    const originalSheetName = optionalSheetName ?? fixedConfig?.sheetName?.trim() ?? key;
    const config = sitemapConfig.find(
      (page) => page.sheetName?.trim() === originalSheetName.trim()
    );
    const values = Object.entries(rowContents)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, value]) => cleanText(value))
      .filter(Boolean);

    // 生成内容がないページは、ディレクトリのメタ情報も生成しない。
    if (values.length === 0) continue;

    pages.push({
      key,
      label: config?.label ?? originalSheetName.replace(/^【option】/, "").trim(),
      theme: pageThemes[key] ?? pageThemes[originalSheetName] ?? "",
      content: values.join(" ").slice(0, 2400),
    });
  }

  return pages;
}

function parseGeneratedMetadata(text: string): Array<{
  key?: string;
  h1?: string;
  description?: string;
}> {
  let cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start >= 0 && end >= start) cleaned = cleaned.slice(start, end + 1);

  try {
    const parsed = JSON.parse(jsonrepair(cleaned)) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function generateHpDirectoryMetadata(
  projectName: string,
  projectType: string,
  hpPageOutputs: Record<string, Record<string, string>>,
  sitemapItems: SitemapItem[],
  pageThemes: Record<string, string>
): Promise<DirectoryMetadata[]> {
  const pages = collectDirectoryPages(
    projectType,
    hpPageOutputs,
    sitemapItems,
    pageThemes
  );
  return generateDirectoryMetadataForPages(projectName, pages);
}

export async function generateDirectoryMetadataForPages(
  projectName: string,
  pages: DirectoryPageInput[]
): Promise<DirectoryMetadata[]> {
  if (pages.length === 0) return [];

  const systemPrompt = `あなたは日本語のWebライティングとSEOメタ情報の編集者です。
実際に生成済みの各ページ本文だけを根拠に、ページごとのH1とディスクリプションを作成してください。

厳守事項:
- H1は日本語で30〜35文字。ページの内容が端的に分かる固有の文にする
- descriptionは日本語で100〜120文字、最大120文字
- ページ本文にない数値・実績・サービス・地域名を創作しない
- ページごとに内容を変え、同じ文章を使い回さない
- CTAだけの文章や、根拠のない最上級表現を避ける
- 指定されたkeyは変更しない

出力は次のJSON配列のみ:
[{"key":"...","h1":"...","description":"..."}]`;

  const userPrompt = `【会社・サイト名】
${projectName}

【生成済みページ】
${JSON.stringify(
  pages.map((page) => ({
    key: page.key,
    pageName: page.label,
    theme: page.theme,
    content: page.content,
  }))
)}`;

  let generatedByKey = new Map<string, { h1?: string; description?: string }>();
  try {
    const text = await generateWriting(systemPrompt, userPrompt);
    generatedByKey = new Map(
      parseGeneratedMetadata(text)
        .filter((item) => typeof item.key === "string")
        .map((item) => [String(item.key), item])
    );
  } catch (error) {
    console.warn(
      "[hp-directory-metadata] AI generation failed; using page-content fallback:",
      error instanceof Error ? error.message : String(error)
    );
  }

  return pages.map((page) => {
    const generated = generatedByKey.get(page.key);
    return {
      key: page.key,
      label: page.label,
      h1: fitH1(generated?.h1 ?? "", page.label, projectName),
      description: fitDescription(
        generated?.description ?? "",
        page.content
      ),
    };
  });
}
