import { NextResponse } from "next/server";
import { generateWriting } from "@/lib/claude";
import { meoSystemPrompt, meoUserPrompt } from "@/lib/templates/meo";
import { hpSystemPrompt, hpUserPrompt } from "@/lib/templates/hp";
import { lpSystemPrompt, lpUserPrompt } from "@/lib/templates/lp";
import { searchWeb } from "@/lib/scraper";
import { jsonrepair } from "jsonrepair";

export async function POST(req: Request) {
  const { type, hpContent, hearing, products } = await req.json();

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
    userPrompt = meoUserPrompt(hpContent ?? "", hearing ?? "", products ?? [], searchInfo);
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
    return NextResponse.json({ output: parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
