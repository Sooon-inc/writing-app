import * as cheerio from "cheerio";

export async function scrapeUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // Remove script, style, nav, footer elements
  $("script, style, nav, footer, header, noscript, iframe").remove();

  const title = $("title").text().trim();
  const description =
    $('meta[name="description"]').attr("content")?.trim() ?? "";
  const keywords =
    $('meta[name="keywords"]').attr("content")?.trim() ?? "";

  // Extract main body text
  const bodyText = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);

  const parts = [
    title ? `【タイトル】${title}` : "",
    description ? `【メタ説明】${description}` : "",
    keywords ? `【キーワード】${keywords}` : "",
    bodyText ? `【本文】${bodyText}` : "",
  ].filter(Boolean);

  return parts.join("\n\n");
}
