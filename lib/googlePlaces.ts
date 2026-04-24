/**
 * Google Places API を使って Google マップ URL から店舗情報を取得する
 *
 * 必要な環境変数: GOOGLE_PLACES_API_KEY
 * Google Cloud Console で「Places API」を有効化すること
 */

const PLACES_BASE = "https://maps.googleapis.com/maps/api/place";
// フル版フィールド（Contact・Atmosphere フィールドは課金対象の場合あり）
const DETAIL_FIELDS_FULL = [
  "name",
  "formatted_address",
  "formatted_phone_number",
  "opening_hours",
  "rating",
  "user_ratings_total",
  "website",
].join(",");

// 基本フィールドのみ（課金不要・制限なしで取得できる）
const DETAIL_FIELDS_BASIC = [
  "name",
  "formatted_address",
  "formatted_phone_number",
  "website",
].join(",");

export interface PlaceInfo {
  name: string;
  address: string;
  phone: string;
  hours: string;
  rating: string;
  website: string;
  placeId: string;
}

/** ChIJ 形式の place_id が URL に直接含まれる場合に抽出 */
function extractPlaceIdFromUrl(url: string): string {
  const match = url.match(/[!&?]1s(ChIJ[A-Za-z0-9_-]+)/);
  return match ? match[1] : "";
}

/** URL パスまたは ?q= から店舗名を抽出 */
function extractNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const placeMatch = u.pathname.match(/\/maps\/place\/([^/@]+)/);
    if (placeMatch) {
      const raw = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
      // (株) や +81 などの記号を含む場合でも返す
      return raw;
    }
    const q = u.searchParams.get("q");
    if (q) return q;
  } catch {}
  return "";
}

/** URL から緯度経度を抽出 (/@lat,lng,zoom 形式) */
function extractLatLng(url: string): { lat: number; lng: number } | null {
  const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  return null;
}

/** URL data 部の 0xHIGH:0xLOW から CID（10進数文字列）を取得 */
function extractCidFromUrl(url: string): string {
  try {
    const match = url.match(/!1s(0x[0-9a-f]+):(0x[0-9a-f]+)/i);
    if (!match) return "";
    // LOW 部分を BigInt で変換（符号なし 64bit → 10 進数）
    const low = BigInt(match[2]);
    return low.toString(10);
  } catch {}
  return "";
}

/** 短縮 URL を展開 */
async function expandShortUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    return res.url || url;
  } catch {
    return url;
  }
}

/** CID から place_id を取得 */
async function findPlaceIdByCid(cid: string, apiKey: string): Promise<string> {
  const endpoint =
    `${PLACES_BASE}/details/json?cid=${cid}&fields=place_id&key=${apiKey}`;
  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(10000) });
    const data = (await res.json()) as { result?: { place_id?: string }; status?: string };
    console.log("[places] CID lookup status:", data.status);
    return data.result?.place_id ?? "";
  } catch {
    return "";
  }
}

/** テキスト検索で place_id を取得（位置バイアスあり） */
async function findPlaceIdByText(
  query: string,
  apiKey: string,
  latLng?: { lat: number; lng: number } | null
): Promise<string> {
  // (株) を 株式会社 に変換してリトライするためのクエリ候補を作成
  const queries = [
    query,
    query.replace(/\(株\)/g, "株式会社").replace(/\(有\)/g, "有限会社"),
    query.replace(/株式会社/g, "").replace(/有限会社/g, "").trim(),
  ].filter((q, i, arr) => q && arr.indexOf(q) === i);

  for (const q of queries) {
    let endpoint =
      `${PLACES_BASE}/findplacefromtext/json` +
      `?input=${encodeURIComponent(q)}` +
      `&inputtype=textquery` +
      `&fields=place_id,name` +
      `&language=ja` +
      `&key=${apiKey}`;

    if (latLng) {
      endpoint += `&locationbias=circle:5000@${latLng.lat},${latLng.lng}`;
    }

    try {
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(10000) });
      const data = (await res.json()) as {
        candidates?: { place_id?: string; name?: string }[];
        status?: string;
      };
      console.log(`[places] text search "${q}" status:`, data.status, "candidates:", data.candidates?.length ?? 0);
      const placeId = data.candidates?.[0]?.place_id;
      if (placeId) return placeId;
    } catch {}
  }
  return "";
}

/** place_id から店舗詳細を取得（フル版が失敗したら基本フィールドのみでリトライ） */
async function fetchPlaceDetails(placeId: string, apiKey: string): Promise<PlaceInfo> {
  type RawResult = {
    result?: {
      name?: string;
      formatted_address?: string;
      formatted_phone_number?: string;
      opening_hours?: { weekday_text?: string[] };
      rating?: number;
      user_ratings_total?: number;
      website?: string;
    };
    status?: string;
  };

  const fetchDetails = async (fields: string): Promise<RawResult> => {
    const endpoint =
      `${PLACES_BASE}/details/json` +
      `?place_id=${encodeURIComponent(placeId)}` +
      `&fields=${fields}` +
      `&language=ja` +
      `&key=${apiKey}`;
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(10000) });
    return res.json() as Promise<RawResult>;
  };

  // まずフル版で試行
  let data = await fetchDetails(DETAIL_FIELDS_FULL);
  console.log("[places] details(full) status:", data.status);

  // REQUEST_DENIED の場合は基本フィールドのみでリトライ
  if (data.status === "REQUEST_DENIED") {
    console.warn("[places] full fields denied, retrying with basic fields...");
    data = await fetchDetails(DETAIL_FIELDS_BASIC);
    console.log("[places] details(basic) status:", data.status);
  }

  const r = data.result ?? {};
  return {
    name: r.name ?? "",
    address: r.formatted_address ?? "",
    phone: r.formatted_phone_number ?? "",
    hours: r.opening_hours?.weekday_text?.join(" / ") ?? "",
    rating:
      r.rating != null
        ? `${r.rating}${r.user_ratings_total ? `（${r.user_ratings_total}件）` : ""}`
        : "",
    website: r.website ?? "",
    placeId,
  };
}

/**
 * Google マップ URL → 店舗情報テキストを返すメイン関数
 */
export async function getPlaceInfoFromMapsUrl(mapsUrl: string): Promise<string> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn("[places] GOOGLE_PLACES_API_KEY is not set");
    return "";
  }

  let url = mapsUrl.trim();
  if (!url) return "";

  try {
    // 短縮 URL を展開
    if (url.includes("goo.gl") || url.includes("maps.app.goo.gl")) {
      console.log("[places] expanding short URL:", url);
      url = await expandShortUrl(url);
      console.log("[places] expanded to:", url.substring(0, 120) + "...");
    }

    // 補助情報を抽出
    const latLng = extractLatLng(url);
    const name = extractNameFromUrl(url);
    console.log("[places] name from URL:", name, "| latLng:", latLng);

    // place_id を取得（ChIJ → CID → テキスト検索 の順）
    let placeId = extractPlaceIdFromUrl(url);
    console.log("[places] ChIJ from URL:", placeId || "(none)");

    if (!placeId) {
      // ?cid= パラメータを確認
      const cidParam = new URL(url).searchParams.get("cid");
      if (cidParam) {
        console.log("[places] cid param:", cidParam);
        placeId = await findPlaceIdByCid(cidParam, apiKey);
      }
    }

    if (!placeId) {
      // URL data 部の 0x hex から CID を生成
      const cid = extractCidFromUrl(url);
      if (cid) {
        console.log("[places] cid from hex:", cid);
        placeId = await findPlaceIdByCid(cid, apiKey);
      }
    }

    if (!placeId && name) {
      // 位置バイアス付きテキスト検索
      placeId = await findPlaceIdByText(name, apiKey, latLng);
    }

    if (!placeId) {
      console.warn("[places] could not resolve place_id");
      return "";
    }

    console.log("[places] resolved place_id:", placeId);
    const info = await fetchPlaceDetails(placeId, apiKey);
    console.log("[places] fetched:", info.name, info.address);

    return [
      info.name    ? `【店舗名】${info.name}` : "",
      info.address ? `【住所】${info.address}` : "",
      info.phone   ? `【電話番号】${info.phone}` : "",
      info.hours   ? `【営業時間】${info.hours}` : "",
      info.rating  ? `【評価】${info.rating}` : "",
      info.website ? `【Webサイト】${info.website}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } catch (e) {
    console.error("[places] error:", e instanceof Error ? e.message : String(e));
    return "";
  }
}
