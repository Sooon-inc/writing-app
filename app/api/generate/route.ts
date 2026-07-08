import { NextResponse } from "next/server";
import { generateWriting } from "@/lib/claude";
import { meoSystemPrompt, meoUserPrompt } from "@/lib/templates/meo";
import { hpSystemPrompt, hpUserPrompt } from "@/lib/templates/hp";
import { lpSystemPrompt, lpUserPrompt } from "@/lib/templates/lp";
import { portalSystemPrompt, portalUserPrompt } from "@/lib/templates/portal";
import { searchWeb } from "@/lib/scraper";
import { getPlaceInfoFromMapsUrl } from "@/lib/googlePlaces";
import { reviewAndReviseMarketingJson } from "@/lib/contentQuality";
import { researchMeoContext } from "@/lib/meoResearch";
import { reviewAndReviseMeo } from "@/lib/meoQuality";
import { ensureMeoOutput } from "@/lib/meoOutput";
import { jsonrepair } from "jsonrepair";

type MeoServiceItem = {
  商品サービス名: string;
  商品カテゴリ: string;
  商品価格: string;
  商品説明: string;
};

type MeoServiceDescriptionItem = {
  商品サービス名: string;
  商品カテゴリ: string;
  商品説明: string;
};

// R23用: GBP商品欄（700文字前後）を全商品まとめて生成
const meoServiceDescriptionsSystemPrompt = `あなたはMEO対策のコンテンツライターです。Googleビジネスプロフィールの「商品」欄に入力する説明文を作成してください。

【ルール】
- 入力された商品・サービスごとに1件ずつ作成する
- 入力された商品・サービス名、件数、順番を必ず維持する
- 商品カテゴリは1社全体で4種類以内に収める
- 商品説明は各700文字前後（650〜750字を目安）
- 顧客目線・語り口調で価値を伝える
- このサービスが解決する顧客の悩みや提供する価値を具体的に説明
- ハルシネーション禁止：提供された情報のみ使用
- 最後は「ぜひお気軽にご相談ください」などのオファー文で締める
- JSONのみ出力。前置き・後置き・コードブロックは禁止

必ず以下のJSON形式で出力してください:
{
  "items": [
    {
      "商品サービス名": "入力された商品・サービス名",
      "商品カテゴリ": "カテゴリ名",
      "商品説明": "650〜750字の説明文"
    }
  ]
}`;

function cleanJson(raw: string): string {
  let cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  return cleaned;
}

async function generateMeoProductDescriptions(input: {
  products: string[];
  existingServices: MeoServiceItem[];
  context: string;
}): Promise<MeoServiceDescriptionItem[]> {
  const existingHints = input.products
    .map((name, index) => {
      const existing = input.existingServices.find((item) => item.商品サービス名 === name) ?? input.existingServices[index];
      return [
        `${index + 1}. ${name}`,
        existing?.商品カテゴリ ? `カテゴリ候補: ${existing.商品カテゴリ}` : "",
        existing?.商品説明 ? `既存説明の要点: ${existing.商品説明.slice(0, 260)}` : "",
      ].filter(Boolean).join("\n");
    })
    .join("\n\n");

  const raw = await generateWriting(
    meoServiceDescriptionsSystemPrompt,
    `【商品・サービス一覧】\n${existingHints}

【会社情報・ヒアリング】
${input.context || "情報なし"}

上記の商品・サービスすべてについて、同じ順番で説明文JSONを作成してください。`
  );

  const parsed = JSON.parse(jsonrepair(cleanJson(raw))) as { items?: MeoServiceDescriptionItem[] };
  return Array.isArray(parsed.items) ? parsed.items : [];
}

export async function POST(req: Request) {
  const { type, hpContent, hearing, industries = [], products, gbpContent, gbpUrl } = await req.json();

  if (!type) {
    return NextResponse.json({ error: "type is required" }, { status: 400 });
  }

  let systemPrompt: string;
  let userPrompt: string;
  let meoEvidenceContext = "";

  if (type === "meo") {
    // HP情報から店舗名を抽出
    const titleMatch = (hpContent ?? "").match(/【タイトル】([^\n]+)/);
    const rawTitle = titleMatch ? titleMatch[1] : "";
    const businessName = rawTitle.split(/[|｜\-－/／]/).map((s: string) => s.trim()).find((s: string) => s.length > 0) ?? "";

    // Google Maps URL かどうか判定
    const isMapsUrl = (url: string) =>
      url.includes("google.com/maps") ||
      url.includes("maps.google.com") ||
      url.includes("goo.gl") ||
      url.includes("maps.app.goo.gl");

    // Places API（Google Maps URL）と DuckDuckGo 検索を並列実行
    const [placesInfo, addressResult, stationResult] = await Promise.all([
      gbpUrl && isMapsUrl(gbpUrl) ? getPlaceInfoFromMapsUrl(gbpUrl) : Promise.resolve(""),
      businessName ? searchWeb(`${businessName} 住所 電話番号`) : Promise.resolve(""),
      businessName ? searchWeb(`${businessName} 最寄り駅 アクセス`) : Promise.resolve(""),
    ]);

    // Places API の結果を優先、なければスクレイプ済み gbpContent を使用
    const resolvedGbpContent = placesInfo || gbpContent || "";
    const searchInfo = [addressResult, stationResult].filter(Boolean).join("\n");
    const industryList = Array.isArray(industries)
      ? industries.filter((value): value is string => typeof value === "string" && value.trim() !== "")
      : [];
    const fallbackIndustries = hearing?.match(/【業種】([^\n]+)/)?.[1]?.split(/[、,]/).filter(Boolean) ?? [];
    const researchInfo = await researchMeoContext({
      gbpContent: resolvedGbpContent,
      hpContent: hpContent ?? "",
      industries: industryList.length ? industryList : fallbackIndustries,
      businessName,
    });

    systemPrompt = meoSystemPrompt;
    userPrompt = meoUserPrompt(hpContent ?? "", hearing ?? "", products ?? [], searchInfo, resolvedGbpContent, researchInfo);
    meoEvidenceContext = [
      "【HP情報】", hpContent ?? "",
      "【GBP・Places情報】", resolvedGbpContent,
      "【補助検索情報】", searchInfo,
      "【地域・業種調査】", researchInfo,
      "【ヒアリング】", hearing ?? "",
      "【入力業種】", industryList.join("、"),
      "【入力商品サービス】", Array.isArray(products) ? products.join("、") : "",
    ].join("\n");
  } else if (type === "portal") {
    systemPrompt = portalSystemPrompt;
    userPrompt = portalUserPrompt({ hpContent: hpContent ?? "", gbpContent: gbpContent ?? "", snsContent: "", hearing: hearing ?? "" });
  } else if (type === "lp") {
    systemPrompt = lpSystemPrompt;
    userPrompt = lpUserPrompt(hpContent ?? "", hearing ?? "");
  } else {
    // hp-strong, hp-classic, hp-beauty, hp-recruit
    systemPrompt = hpSystemPrompt(type);
    userPrompt = hpUserPrompt(hpContent ?? "", hearing ?? "");
  }

  try {
    const result = await generateWriting(systemPrompt, userPrompt);
    // Strip markdown code block if present, then repair and parse
    const cleaned = result.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const parsed = JSON.parse(jsonrepair(cleaned));
    const initialParsed = type === "meo" ? ensureMeoOutput(parsed) : parsed;

    // MEO: ユーザー入力の商品数を厳守し、説明文を項目ごとに個別生成（並列）
    if (type === "meo") {
      const claudeServices = (initialParsed["商品サービス"] ?? []) as MeoServiceItem[];
      const filledProducts = (products ?? []).filter((p: string) => p.trim()) as string[];

      if (filledProducts.length > 0) {
        // Claudeの出力からカテゴリを名前一致 or インデックスで取得
        const getCat = (name: string, i: number): string =>
          claudeServices.find((s) => s.商品サービス名 === name)?.商品カテゴリ
          ?? claudeServices[i]?.商品カテゴリ
          ?? "";

        const context = [hpContent, gbpContent, hearing].filter(Boolean).join("\n\n");
        let generatedDescriptions: MeoServiceDescriptionItem[] = [];
        try {
          generatedDescriptions = await generateMeoProductDescriptions({
            products: filledProducts,
            existingServices: claudeServices,
            context,
          });
        } catch (error) {
          console.warn("[meo] batch product description generation failed, falling back to initial output:", error instanceof Error ? error.message : String(error));
        }

        const getGenerated = (name: string, i: number): MeoServiceDescriptionItem | undefined =>
          generatedDescriptions.find((item) => item.商品サービス名 === name) ?? generatedDescriptions[i];

        // ユーザー入力の商品名・件数で上書き
        initialParsed["商品サービス"] = filledProducts.map((name, i) => ({
          商品サービス名: name,
          商品カテゴリ: getGenerated(name, i)?.商品カテゴリ || getCat(name, i),
          商品価格: "非表示",
          商品説明:
            getGenerated(name, i)?.商品説明?.trim()
            || claudeServices.find((s) => s.商品サービス名 === name)?.商品説明
            || claudeServices[i]?.商品説明
            || "",
        }));
      }
    }

    if (type !== "meo") {
      const checked = await reviewAndReviseMarketingJson(initialParsed, {
        contentType: String(type),
      });
      return NextResponse.json({
        output: checked.output,
        qualityReview: checked.review,
        qualityRevisionAttempts: checked.attempts,
      });
    }

    const checked = await reviewAndReviseMeo(initialParsed, meoEvidenceContext);
    const output = ensureMeoOutput(checked.output);
    return NextResponse.json({
      output,
      qualityReview: checked.review,
      qualityRevisionAttempts: checked.attempts,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    console.error("[generate] generation failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
