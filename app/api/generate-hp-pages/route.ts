import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as ExcelJS from "exceljs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { HP_TEMPLATE_PATHS } from "@/lib/hpSitemap";
import { getPlaceInfoFromMapsUrl } from "@/lib/googlePlaces";
import { reviewAndReviseMarketingJson } from "@/lib/contentQuality";

const client = new Anthropic();

export const maxDuration = 300;

function getCellText(row: ExcelJS.Row, colIndex: number): string {
  const cell = row.getCell(colIndex);
  const v = cell.value;
  if (!v) return "";
  if (typeof v === "object" && "richText" in v) {
    return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("").trim();
  }
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return "";
}

async function extractSheetFields(
  wb: ExcelJS.Workbook,
  sheetName: string
): Promise<{ rn: number; section: string; label: string; charLimit: string }[]> {
  const sheet =
    wb.getWorksheet(sheetName) ??
    wb.worksheets.find((s) => s.name.trim() === sheetName.trim());
  if (!sheet) return [];

  const fields: { rn: number; section: string; label: string; charLimit: string }[] = [];
  sheet.eachRow((row, rn) => {
    const c2 = getCellText(row, 2);
    const c4 = getCellText(row, 4);
    const c8 = getCellText(row, 8);
    const c12 = getCellText(row, 12);
    const c13 = getCellText(row, 13);
    const label = (c4 || c8 || "").trim();
    const section = c2.trim();

    if (
      !label ||
      label === "項目・要素" ||
      label === "完成理想文字数" ||
      rn <= 4
    )
      return;
    // Skip group header rows (e.g. "一つ目", "上段", "左エリア") and
    // informational rows — identified by column 13 already having a marker value
    if (c13) return;
    // Skip merged informational rows where section text == label text
    if (c2 && c4 && c2 === c4) return;
    if (
      label.includes("本文（文章") ||
      label.includes("完成理想") ||
      (label.includes("ページ") && section.includes("ページ"))
    )
      return;

    fields.push({ rn, section, label, charLimit: c12 });
  });
  return fields;
}

async function generatePageContent(
  sheetName: string,
  fields: { rn: number; section: string; label: string; charLimit: string }[],
  hpContent: string,
  hearing: string,
  theme: string,
  gbpContent?: string
): Promise<Record<number, string>> {
  if (fields.length === 0) return {};

  // セクション名の改行を除去してプロンプト崩れを防ぐ
  const fieldList = fields
    .map((f) => {
      const section = f.section.replace(/\s*\n\s*/g, " ").trim();
      const limit = f.charLimit && f.charLimit !== "-" ? ` (${f.charLimit})` : "";
      return `行${f.rn}: [${section}] ${f.label}${limit}`;
    })
    .join("\n");

  const systemPrompt = `あなたはホームページ制作のライティング専門家です。
クライアントのHP情報とヒアリング内容をもとに、ヒアリングシートの各項目を埋めてください。

ルール:
- 「会社名」や「当社」は使わず、ヒアリング情報から得た実際の社名・店名を使用
- 文字数制限がある場合は必ず守る
- テーマ・キーワードが指定されている場合は、そのテーマやキーワードを優先的に反映する
- 電話番号・住所・FAX・代表者名・資本金・URLなどの事実情報は正確に抽出。不明な場合は「（不明）」と記載する（空文字や省略はしない）
- Instagram/LINE/SNSのURLは情報から抽出（なければ「（不明）」）
- 欧文見出し(英語)は短い英単語やフレーズ
- リンク先はURLパス（例: /about, /service）
- 写真説明系（〜写真）はファイル名や説明文ではなく写真の説明テキスト
- キャッチコピー・見出し・説明文などのライティング項目は、情報をもとに積極的に文章を生成する
- 電話番号・住所・URL・SNSリンクなど事実情報のみ、不明な場合は空文字にする

出力: 以下のJSON形式のみ返してください（コードブロック・説明文・前置き一切不要）
{"行番号": "内容", ...}`;

  const userPrompt = `【ページ名】${sheetName}
${theme ? `\n【テーマ・キーワード】\n${theme}\n` : ""}
【HP情報】
${hpContent || "（なし）"}
${gbpContent ? `\n【Googleビジネスプロフィール情報（住所・電話番号・営業時間などの事実情報として優先使用）】\n${gbpContent}` : ""}

【ヒアリング内容】
${hearing || "（なし）"}

【埋める項目一覧】
${fieldList}

上記の項目を埋めたJSONを返してください。`;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      { role: "user", content: userPrompt },
    ],
  });

  const text = (msg.content[0] as { type: string; text: string }).text;

  // コードブロック除去、レスポンス内の最初の { から最後の } を抽出
  let cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd !== -1) {
    cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
  }

  try {
    const parsed = JSON.parse(cleaned) as Record<string, string>;
    const result: Record<number, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const rowNum = parseInt(String(k).replace(/[^0-9]/g, "").trim());
      if (!isNaN(rowNum) && rowNum > 0) result[rowNum] = String(v ?? "");
    }
    return result;
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  const { projectId, sheetName, instanceKey, theme } = (await req.json()) as {
    projectId: string;
    sheetName: string;
    instanceKey: string;
    theme?: string;
  };

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const templatePath = HP_TEMPLATE_PATHS[project.type];
  if (!templatePath) {
    return NextResponse.json({ error: "Unsupported HP type" }, { status: 400 });
  }

  // GBP URL が Google Maps URL なら Places API で情報取得
  const isMapsUrl = (url: string) =>
    url.includes("google.com/maps") ||
    url.includes("maps.google.com") ||
    url.includes("goo.gl") ||
    url.includes("maps.app.goo.gl");
  const gbpContent = project.gbpUrl && isMapsUrl(project.gbpUrl)
    ? await getPlaceInfoFromMapsUrl(project.gbpUrl).catch(() => "")
    : "";

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(process.cwd(), templatePath));

  const fields = await extractSheetFields(wb, sheetName);
  const industries = (() => {
    try { return JSON.parse(project.industries ?? "[]") as string[]; } catch { return []; }
  })();
  const content = await generatePageContent(
    sheetName,
    fields,
    project.hpContent ?? "",
    `【業種】${industries.join("、")}\n${project.hearing ?? ""}`,
    theme ?? "",
    gbpContent
  );
  const checked = await reviewAndReviseMarketingJson(content, {
    contentType: `HP:${sheetName}`,
    maxRevisionAttempts: 0,
  });
  const hpPageOutputs: Record<string, Record<number, string>> = {
    [instanceKey]: checked.output,
  };

  // Merge with existing hpPageOutputs so each call accumulates rather than overwrites
  let existingOutputs: Record<string, Record<number, string>> = {};
  try {
    if (project.hpPageOutputs) {
      existingOutputs = JSON.parse(project.hpPageOutputs) as Record<string, Record<number, string>>;
    }
  } catch { /* ignore */ }
  const mergedOutputs = { ...existingOutputs, ...hpPageOutputs };

  await prisma.project.update({
    where: { id: projectId },
    data: {
      hpPageOutputs: JSON.stringify(mergedOutputs),
    },
  });

  return NextResponse.json({
    hpPageOutputs,
    qualityReview: checked.review,
    qualityRevisionAttempts: checked.attempts,
  });
}
