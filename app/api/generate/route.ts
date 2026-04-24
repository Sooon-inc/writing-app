import { NextResponse } from "next/server";
import { generateWriting } from "@/lib/claude";
import { meoSystemPrompt, meoUserPrompt } from "@/lib/templates/meo";
import { hpSystemPrompt, hpUserPrompt } from "@/lib/templates/hp";
import { lpSystemPrompt, lpUserPrompt } from "@/lib/templates/lp";
import { portalSystemPrompt, portalUserPrompt } from "@/lib/templates/portal";
import { searchWeb } from "@/lib/scraper";
import { jsonrepair } from "jsonrepair";

const meoServiceDescSystemPrompt = `あなたはMEO対策のコンテンツライターです。Googleビジネスプロフィールの商品・サービス説明文を作成してください。

【ルール】
- 600〜800字
- 顧客目線・語り口調で価値を伝える
- このサービスが解決する顧客の悩みや提供する価値を具体的に説明
- ハルシネーション禁止：提供された情報のみ使用
- 最後は「ぜひお気軽にご相談ください」などのオファー文で締める
- 文章のみ出力（JSONや余分な説明は不要）`;

export async function POST(req: Request) {
  const { type, hpContent, hearing, products, gbpContent } = await req.json();

  if (!type) {
    return NextResponse.json({ error: "type is required" }, { status: 400 });
  }

  let systemPrompt: string;
  let userPrompt: string;

  if (type === "meo") {
    // HP情報から店舗名を抽出してWeb検索
    const titleMatch = (hpContent ?? "").match(/【タイトル】([^\n]+)/);
    const rawTitle = titleMatch ? titleMatch[1] : "";
    const businessName = rawTitle.split(/[|｜\-－/／]/).map((s: string) => s.trim()).find((s: string) => s.length > 0) ?? "";

    let searchInfo = "";
    if (businessName) {
      const [addressResult, stationResult] = await Promise.all([
        searchWeb(`${businessName} 住所 電話番号`),
        searchWeb(`${businessName} 最寄り駅 アクセス`),
      ]);
      const combined = [addressResult, stationResult].filter(Boolean).join("\n");
      if (combined) searchInfo = combined;
    }

    systemPrompt = meoSystemPrompt;
    userPrompt = meoUserPrompt(hpContent ?? "", hearing ?? "", products ?? [], searchInfo, gbpContent ?? "");
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

    // MEO: ユーザー入力の商品数を厳守し、説明文を項目ごとに個別生成（並列）
    if (type === "meo") {
      type ServiceItem = { 商品サービス名: string; 商品カテゴリ: string; 商品価格: string; 商品説明: string };
      const claudeServices = (parsed["商品サービス"] ?? []) as ServiceItem[];
      const filledProducts = (products ?? []).filter((p: string) => p.trim()) as string[];

      if (filledProducts.length > 0) {
        // Claudeの出力からカテゴリを名前一致 or インデックスで取得
        const getCat = (name: string, i: number): string =>
          claudeServices.find((s) => s.商品サービス名 === name)?.商品カテゴリ
          ?? claudeServices[i]?.商品カテゴリ
          ?? "";

        const context = [hpContent, gbpContent, hearing].filter(Boolean).join("\n\n");
        const descPromises = filledProducts.map((name, i) =>
          generateWriting(
            meoServiceDescSystemPrompt,
            `【商品・サービス名】\n${name}\n\n【カテゴリの目安】\n${getCat(name, i)}\n\n【会社情報・ヒアリング】\n${context}\n\nこのサービスの説明文を600〜800字で作成してください。`
          ).then((t) => t.trim())
        );
        const descs = await Promise.all(descPromises);

        // ユーザー入力の商品名・件数で上書き
        parsed["商品サービス"] = filledProducts.map((name, i) => ({
          商品サービス名: name,
          商品カテゴリ: getCat(name, i),
          商品価格: "非表示",
          商品説明: descs[i],
        }));
      }
    }

    return NextResponse.json({ output: parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
