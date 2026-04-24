import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scrapeUrl } from "@/lib/scraper";
import { generateWriting } from "@/lib/claude";
import { portalSystemPrompt, portalUserPrompt } from "@/lib/templates/portal";
import { getPlaceInfoFromMapsUrl } from "@/lib/googlePlaces";
import { jsonrepair } from "jsonrepair";

// Next.js ルートハンドラのタイムアウトを延長（Vercel 対応）
export const maxDuration = 300;

interface SNSInput {
  instagram?: string;
  tiktok?: string;
  youtube?: string;
}

/** URL を安全にスクレイピング。失敗時は空文字を返す */
async function safeScrape(url: string, label: string): Promise<string> {
  if (!url?.trim()) return "";
  try {
    console.log(`[portal] scraping ${label}: ${url}`);
    const content = await scrapeUrl(url.trim());
    console.log(`[portal] ${label} scraped: ${content.length} chars`);
    return content;
  } catch (e) {
    console.warn(`[portal] ${label} scrape failed:`, e instanceof Error ? e.message : String(e));
    return "";
  }
}

/** SNS URL を並列スクレイピングし結合テキストを返す */
async function scrapeSNS(sns: SNSInput): Promise<string> {
  const targets = [
    { label: "Instagram", url: sns.instagram },
    { label: "TikTok", url: sns.tiktok },
    { label: "YouTube", url: sns.youtube },
  ].filter((t): t is { label: string; url: string } => !!t.url?.trim());

  const results = await Promise.all(
    targets.map(async (t) => {
      const content = await safeScrape(t.url, t.label);
      return content ? `【${t.label}】\n${content}` : "";
    })
  );

  return results.filter(Boolean).join("\n\n");
}

/**
 * GBP URL から情報を取得する。
 * Google マップ URL → Places API、それ以外の URL → スクレイピング にフォールバック。
 */
async function fetchGbpContent(gbpUrl: string): Promise<string> {
  if (!gbpUrl?.trim()) return "";

  const isGoogleMaps =
    gbpUrl.includes("google.com/maps") ||
    gbpUrl.includes("maps.google.com") ||
    gbpUrl.includes("goo.gl") ||
    gbpUrl.includes("maps.app.goo.gl");

  if (isGoogleMaps) {
    console.log("[portal] GBP URL is Google Maps, using Places API");
    const placesContent = await getPlaceInfoFromMapsUrl(gbpUrl);
    if (placesContent) {
      console.log(`[portal] Places API success: ${placesContent.length} chars`);
      return placesContent;
    }
    console.warn("[portal] Places API returned empty, skipping GBP");
    return "";
  }

  // Google マップ以外（例: business.google.com）はスクレイピングを試みる
  return safeScrape(gbpUrl, "GBP");
}

/** 入力データを収集して1つのコンテキストにまとめる */
async function collectInputData(
  hpUrl: string,
  gbpUrl: string,
  sns: SNSInput,
  hearing: string
) {
  console.log("[portal] collecting input data...");
  const [hpContent, gbpContent, snsContent] = await Promise.all([
    safeScrape(hpUrl, "HP"),
    fetchGbpContent(gbpUrl),
    scrapeSNS(sns),
  ]);
  console.log(
    `[portal] collected: HP=${hpContent.length}chars GBP=${gbpContent.length}chars SNS=${snsContent.length}chars hearing=${hearing.length}chars`
  );
  return { hpContent, gbpContent, snsContent, hearing };
}

/** Claude でポータル文章を生成してJSONをパース */
async function generatePortalContent(inputData: {
  hpContent: string;
  gbpContent: string;
  snsContent: string;
  hearing: string;
}): Promise<Record<string, string>> {
  console.log("[portal] generating content via Claude...");
  const userPrompt = portalUserPrompt(inputData);
  const raw = await generateWriting(portalSystemPrompt, userPrompt);

  if (!raw || !raw.trim()) {
    throw new Error("Claude returned empty response");
  }

  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(jsonrepair(cleaned)) as Record<string, string>;
  } catch (e) {
    console.error("[portal] JSON parse failed. raw length:", raw.length, "error:", e);
    throw new Error(`JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  console.log("[portal] generation complete:", Object.keys(parsed).join(", "));
  return parsed;
}

export async function POST(req: NextRequest) {
  // ─ リクエストボディのパース ────────────────
  let body: {
    projectId?: string;
    hpUrl?: string;
    gbpUrl?: string;
    sns?: SNSInput;
    hearing?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body: JSON parse failed" },
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { projectId, hpUrl = "", gbpUrl = "", sns = {}, hearing = "" } = body;

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // ─ メイン処理を全体でキャッチ ────────────────
  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // ① 入力データを収集・統合
    const inputData = await collectInputData(hpUrl, gbpUrl, sns, hearing);

    // スクレイピング結果と入力値を DB に保存
    await prisma.project.update({
      where: { id: projectId },
      data: {
        hpUrl: hpUrl || project.hpUrl,
        hpContent: (inputData.hpContent || (project.hpContent ?? "")).slice(0, 50000),
        gbpUrl: gbpUrl || project.gbpUrl,
        hearing: hearing || project.hearing,
        sitemap: JSON.stringify({ sns }),
      },
    });

    // ② 文章生成
    const output = await generatePortalContent(inputData);

    // ③ 生成結果を DB に保存
    await prisma.project.update({
      where: { id: projectId },
      data: { output: JSON.stringify(output) },
    });

    return NextResponse.json(
      { output },
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    console.error("[portal] unexpected error:", msg);
    return NextResponse.json(
      { error: msg },
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
