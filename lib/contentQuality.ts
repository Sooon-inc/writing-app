import { jsonrepair } from "jsonrepair";
import { generateWriting } from "@/lib/claude";

export type QualitySeverity = "high" | "mid" | "low";
export type QualityVerdict = "natural" | "needs_revision" | "ai_like";

export interface QualityCheck {
  id: string;
  label: string;
  category: "顧客目線" | "信頼性・トーン" | "構造" | "日本語の癖";
  severity: QualitySeverity;
  hit: boolean;
  evidence: string[];
  reason: string;
  suggestion: string;
}

export interface QualityReport {
  ai_likeness_score: number;
  overall_verdict: QualityVerdict;
  summary: string;
  checks: QualityCheck[];
}

export interface QualityLoopResult<T> {
  output: T;
  review: QualityReport;
  attempts: number;
}

const REVIEW_SYSTEM_PROMPT = `あなたは日本語のWebマーケティング文章（ホームページ・ランディングページの訴求文）を専門に校正する編集者です。
渡された記事全文を読み、「AIが生成した不自然さ」と「訴求文として機能しているか」を、以下のチェック項目に沿って判定してください。

# 判定の基本方針
- これはブログ記事ではなく、顧客に商品・サービスを訴求するLP/HPの文章です。主張は明確であるべきで、両論併記やバランスは求めません。
- ベネフィット3点の列挙やCTAは、訴求文では正当な手法です。それ自体を不自然とは見なさず、「機械的・無根拠・唐突」な場合のみ該当とします。
- 接続詞・箇条書きは「ゼロ」も「過剰」も不自然です。極端な場合のみ指摘してください。
- 確証が持てない項目は hit: false とし、過剰検出を避けてください。
- 該当箇所(evidence)は必ず原文から正確に引用してください。創作・要約しないこと。

# チェック項目
[顧客目線：訴求文で最重要]
- benefit_conversion（重大度:高）: 機能・特徴(Feature)の羅列で止まり、顧客にとっての利益(Benefit)に変換されていない。
- company_centered（重大度:高）: 主語が「当社は」「私たちの強みは」など自社中心で、顧客(あなた)が主語になっていない。
- target_unclear（重大度:中）: 誰に向けた文か絞れておらず、万人向けでぼやけている。
- lack_of_specifics（重大度:高）: 数字・実績・お客様の声・導入事例といった一次情報がなく、一般論に終始している。
- no_empathy（重大度:中）: 読み手の悩み・状況に寄り添う記述がなく、いきなり売り込みに入っている。

[信頼性・トーン]
- baseless_superlative（重大度:高）: 「業界No.1」「最高品質」「絶対」等の最上級・断定を、裏付けなしで使っている。
- cliche_hook（重大度:中）: 「まだ〇〇で消耗していませんか？」など使い古された煽り構文のテンプレ。
- bland_tone（重大度:中）: 当たり障りがなさすぎて誰が書いても同じになる、角のない優等生的なトーン。
- flat_emotion（重大度:低）: 感情の振れ幅がゼロで、機械的に淡々としている。

[構造]
- mechanical_triplet（重大度:中）: 内容に関係なく何でも3項目にまとめる機械的な反復。意図的なベネフィット列挙は除く。
- template_intro（重大度:低）: 「結論から言うと」「まず〜次に〜最後に」等のテンプレ導入の多用。
- abrupt_cta（重大度:中）: 本文の流れと無関係にCTA(問い合わせ・申込誘導)が貼り付いており、文脈から自然に着地していない。

[日本語の癖]
- redundant_subject（重大度:低）: 「あなたは〜」「それは〜」を毎文つける英語直訳的な主語の過剰明示。
- passive_overuse（重大度:低）: 受動態の多用で主体がぼやけている。
- abstract_noun（重大度:中）: 「〜性」「〜化」「〜的」など漢語抽象名詞の積み重ねで、文章の体温が下がっている。

# 出力形式
以下のJSONのみを出力してください。前置き・後置き・コードブロック記号(\`\`\`)は一切付けないこと。

{
  "ai_likeness_score": <0-100の整数。高いほどAIっぽい>,
  "overall_verdict": "<natural | needs_revision | ai_like>",
  "summary": "<全体所見を1〜2文で>",
  "checks": [
    {
      "id": "<項目id>",
      "label": "<項目名>",
      "category": "<顧客目線 | 信頼性・トーン | 構造 | 日本語の癖>",
      "severity": "<high | mid | low>",
      "hit": <true | false>,
      "evidence": ["<原文からの引用>"],
      "reason": "<該当と判断した理由を簡潔に>",
      "suggestion": "<より自然・訴求力のある書き換えの方向性、または具体的な書き換え例>"
    }
  ]
}

checks 配列には、hit が true の項目のみを含めてください。
ai_likeness_score は high該当を重く、low該当を軽く重み付けして算出してください。`;

const REVISION_SYSTEM_PROMPT = `あなたは日本語のWebマーケティング文章を改善する編集者です。
校正チェック結果をもとに、訴求文として自然で具体的な文章へ修正してください。

ルール:
- JSONのみを返す。前置き・後置き・コードブロックは禁止。
- 入力JSONと同じキー構造を必ず維持する。キーの追加・削除・リネームは禁止。
- 事実情報、URL、電話番号、住所、金額、日付、会社名、人名、Place ID、緯度経度、空文字、boolean値は変更しない。
- 情報にない実績・数字・保証・口コミ・受賞歴は作らない。
- 一次情報が不足している場合は、無理に具体数字を捏造せず、読み手の悩み・利用シーン・得られる状態に変換して具体性を補う。
- 「当社」「私たち」中心ではなく、読み手が得られる利点を主語にする。
- CTAは本文の流れから自然につなぐ。
- 文字数指定や既存の短い見出しの粒度はできるだけ守る。`;

function cleanJson(raw: string): string {
  let cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  return cleaned;
}

function parseJsonObject<T>(raw: string): T {
  return JSON.parse(jsonrepair(cleanJson(raw))) as T;
}

function normalizeReport(value: QualityReport): QualityReport {
  const score = Number.isFinite(value.ai_likeness_score)
    ? Math.max(0, Math.min(100, Math.round(value.ai_likeness_score)))
    : 0;
  const verdict: QualityVerdict =
    value.overall_verdict === "ai_like" || value.overall_verdict === "needs_revision"
      ? value.overall_verdict
      : "natural";

  return {
    ai_likeness_score: score,
    overall_verdict: verdict,
    summary: typeof value.summary === "string" ? value.summary : "",
    checks: Array.isArray(value.checks)
      ? value.checks.filter((check) => check && check.hit === true)
      : [],
  };
}

function shouldRevise(report: QualityReport): boolean {
  if (report.overall_verdict !== "natural") return true;
  if (report.ai_likeness_score >= 35) return true;
  return report.checks.some((check) => check.severity === "high" || check.severity === "mid");
}

function objectToArticleText(value: unknown, path = ""): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return text ? `${path}: ${text}` : "";
  }
  if (typeof value === "boolean") return "";
  if (Array.isArray(value)) {
    return value
      .map((item, index) => objectToArticleText(item, `${path}[${index + 1}]`))
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, child]) => objectToArticleText(child, path ? `${path}.${key}` : key))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function mergeNonTextValues<T>(original: T, revised: unknown): T {
  if (typeof original === "string") {
    if (original.trim() === "") return original as T;
    return (typeof revised === "string" ? revised : original) as T;
  }
  if (Array.isArray(original)) {
    if (!Array.isArray(revised)) return original;
    return original.map((item, index) => mergeNonTextValues(item, revised[index])) as T;
  }
  if (original && typeof original === "object") {
    if (!revised || typeof revised !== "object" || Array.isArray(revised)) return original;
    const revisedRecord = revised as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(original as Record<string, unknown>)) {
      next[key] = mergeNonTextValues(value, revisedRecord[key]);
    }
    return next as T;
  }
  return original;
}

export async function reviewMarketingCopy(articleText: string): Promise<QualityReport> {
  const targetText = articleText.trim() || "（文章なし）";
  const raw = await generateWriting(
    REVIEW_SYSTEM_PROMPT,
    `以下の記事全文を校正チェックしてください。\n\n【記事全文】\n${targetText}`
  );
  return normalizeReport(parseJsonObject<QualityReport>(raw));
}

export async function reviewAndReviseMarketingJson<T>(
  initialOutput: T,
  options?: {
    contentType?: string;
    maxRevisionAttempts?: number;
  }
): Promise<QualityLoopResult<T>> {
  const maxRevisionAttempts = options?.maxRevisionAttempts ?? 2;
  let output = initialOutput;
  let review = await reviewMarketingCopy(objectToArticleText(output));
  let attempts = 0;

  while (attempts < maxRevisionAttempts && shouldRevise(review)) {
    attempts += 1;
    const raw = await generateWriting(
      REVISION_SYSTEM_PROMPT,
      `【対象】${options?.contentType ?? "Webマーケティング文章"}

【元のJSON】
${JSON.stringify(output, null, 2)}

【校正チェック結果】
${JSON.stringify(review, null, 2)}

校正チェックで hit:true になった項目を改善し、同じキー構造のJSONのみを返してください。`
    );

    const revised = parseJsonObject<unknown>(raw);
    output = mergeNonTextValues(output, revised);
    review = await reviewMarketingCopy(objectToArticleText(output));
  }

  return { output, review, attempts };
}
