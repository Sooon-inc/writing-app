import { searchWeb } from "@/lib/scraper";

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function extractAddress(gbpContent: string): string {
  return gbpContent.match(/【住所】([^\n]+)/)?.[1]?.trim() ?? "";
}

function extractLocality(address: string): string {
  const match = address.match(/(?:東京都|北海道|(?:京都|大阪)府|.{2,3}県)([^市区町村]*[市区町村])/);
  return match?.[1]?.trim() || address.split(/\s/)[0] || "";
}

export async function researchMeoContext(input: {
  gbpContent: string;
  hpContent: string;
  industries: string[];
  businessName?: string;
}): Promise<string> {
  const address = extractAddress(input.gbpContent);
  const locality = extractLocality(address);
  const industries = unique(input.industries).slice(0, 5);
  const currentYear = new Date().getFullYear();

  const queries = unique([
    locality ? `${locality} 地域特性 人口 世帯 住宅 気候` : "",
    locality && input.businessName ? `${locality} ${input.businessName} 口コミ 評判` : "",
    ...industries.flatMap((industry) => [
      `${industry} ${currentYear} トレンド 顧客ニーズ 日本`,
      locality ? `${locality} ${industry} よくある悩み 需要` : "",
      locality ? `${locality} ${industry} サービス 比較` : "",
    ]),
  ]).slice(0, 12);

  const results = await Promise.all(
    queries.map(async (query) => ({
      query,
      result: await searchWeb(query),
    }))
  );

  const usable = results.filter((item) => item.result.trim());
  return [
    `【調査実行日】${new Date().toISOString().slice(0, 10)}`,
    address ? `【GBPから特定した所在地】${address}` : "【GBPから特定した所在地】取得できず",
    locality ? `【調査対象地域】${locality}` : "【調査対象地域】特定できず",
    industries.length ? `【入力業種】${industries.join("、")}` : "【入力業種】未入力",
    "【Web調査結果】",
    usable.length
      ? usable.map((item) => `■ ${item.query}\n${item.result}`).join("\n\n")
      : "有効な検索結果を取得できませんでした。",
    "【利用ルール】検索スニペットは傾向把握の補助情報です。会社固有の事実・実績・価格・保証としては使用しないでください。複数の情報から確証が得られない動向は採用しないでください。",
  ].join("\n");
}
