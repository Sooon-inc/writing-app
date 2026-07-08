import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as ExcelJS from "exceljs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getPlaceInfoFromMapsUrl } from "@/lib/googlePlaces";
import { reviewAndReviseMarketingJson } from "@/lib/contentQuality";

const client = new Anthropic();
const LP_TEMPLATE_PATH = "templates/lp/lp.xlsx";

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

type LPField = { rn: number; section: string; label: string; condition: string };

async function extractLPFields(): Promise<LPField[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(process.cwd(), LP_TEMPLATE_PATH));

  const sheet = wb.getWorksheet("LP");
  if (!sheet) return [];

  const fields: LPField[] = [];
  sheet.eachRow((row, rn) => {
    if (rn <= 8) return; // Skip header rows

    const section = getCellText(row, 2).replace(/\n/g, " ").trim();
    const condition = getCellText(row, 4).trim();
    const label = getCellText(row, 5).trim();

    if (!label || !section) return;
    if (condition === "記入不要") return; // Auto-generated, skip
    if (label === "項目・要素") return;

    fields.push({ rn, section, label, condition });
  });
  return fields;
}

async function generateLPContent(
  fields: LPField[],
  hpContent: string,
  hearing: string,
  theme: string,
  gbpContent?: string
): Promise<Record<number, string>> {
  if (fields.length === 0) return {};

  const fieldList = fields
    .map((f) => `行${f.rn}: [${f.section}] ${f.label}（${f.condition}）`)
    .join("\n");

  const systemPrompt = `あなたはランディングページ制作のライティング専門家です。
クライアントのHP情報とヒアリング内容をもとに、LPヒアリングシートの各項目を埋めてください。

ルール:
- 「会社名」や「当社」は使わず、ヒアリング情報から得た実際の社名・店名を使用
- 「必須」項目は必ず埋める。「任意」は情報があれば埋め、なければ空文字
- テーマ・キーワードが指定されている場合は、そのテーマを軸にライティングする
- FVエリアの日本語コピーはLP全体のキャッチコピー（インパクト重視、短め）
- 欧文（英語）は短い英語フレーズ
- ハルシネーション禁止: 情報にないことは作らず空文字にする
- 文章は読み手（ユーザー）目線で、悩みに共感してから解決策を提示する流れを意識する

出力: 以下のJSON形式で返してください（コードブロック不要）
{"行番号": "内容", ...}`;

  const userPrompt = `${theme ? `【テーマ・キーワード】\n${theme}\n\n` : ""}【HP情報】
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
    messages: [{ role: "user", content: systemPrompt + "\n\n" + userPrompt }],
  });

  const text = (msg.content[0] as { type: string; text: string }).text;
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  try {
    const parsed = JSON.parse(cleaned) as Record<string, string>;
    const result: Record<number, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const rowNum = parseInt(k.replace("行", "").trim());
      if (!isNaN(rowNum)) result[rowNum] = v;
    }
    return result;
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  const { projectId, theme } = (await req.json()) as {
    projectId: string;
    theme?: string;
  };

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // GBP URL が Google Maps URL なら Places API で情報取得
  const isMapsUrl = (url: string) =>
    url.includes("google.com/maps") ||
    url.includes("maps.google.com") ||
    url.includes("goo.gl") ||
    url.includes("maps.app.goo.gl");
  const gbpContent = project.gbpUrl && isMapsUrl(project.gbpUrl)
    ? await getPlaceInfoFromMapsUrl(project.gbpUrl).catch(() => "")
    : "";

  const fields = await extractLPFields();
  const industries = (() => {
    try { return JSON.parse(project.industries ?? "[]") as string[]; } catch { return []; }
  })();
  const content = await generateLPContent(
    fields,
    project.hpContent ?? "",
    `【業種】${industries.join("、")}\n${project.hearing ?? ""}`,
    theme ?? "",
    gbpContent
  );
  const checked = await reviewAndReviseMarketingJson(content, {
    contentType: "LP",
  });

  const themesJson = JSON.stringify({ LP: theme ?? "" });

  await prisma.project.update({
    where: { id: projectId },
    data: {
      hpPageOutputs: JSON.stringify({ LP: checked.output }),
      hpPageThemes: themesJson,
    },
  });

  return NextResponse.json({
    lpOutput: checked.output,
    qualityReview: checked.review,
    qualityRevisionAttempts: checked.attempts,
  });
}
