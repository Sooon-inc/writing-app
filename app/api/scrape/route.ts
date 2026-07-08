import { NextResponse } from "next/server";
import { scrapeUrl } from "@/lib/scraper";
import { getPlaceInfoFromMapsUrl } from "@/lib/googlePlaces";

function isMapsUrl(url: string): boolean {
  return (
    url.includes("google.com/maps") ||
    url.includes("maps.google.com") ||
    url.includes("goo.gl") ||
    url.includes("maps.app.goo.gl")
  );
}

export async function POST(req: Request) {
  const { url } = await req.json();

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    // Google Maps URL は Places API で取得
    if (isMapsUrl(url)) {
      const content = await getPlaceInfoFromMapsUrl(url);
      if (!content) {
        return NextResponse.json({ error: "GBP情報を取得できませんでした。URLを確認してください。" }, { status: 422 });
      }
      return NextResponse.json({ content });
    }

    // 通常の URL は HTML スクレイピング
    const content = await scrapeUrl(url);
    return NextResponse.json({ content });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scrape failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
