import { NextResponse } from "next/server";
import { scrapeUrl } from "@/lib/scraper";

export async function POST(req: Request) {
  const { url } = await req.json();

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const content = await scrapeUrl(url);
    return NextResponse.json({ content });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scrape failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
