function csvEscape(value: string): string {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function row(label: string, value: string): string {
  return `${csvEscape(label)},${csvEscape(value)}`;
}

export function meoOutputToCsv(
  output: Record<string, unknown>,
  projectName: string,
  hpUrl: string
): string {
  const rows: string[] = [];

  const 基本情報 = (output["基本情報"] as Record<string, string>) ?? {};
  const 強み = (output["強み"] as string[]) ?? [];
  const キーワード = (output["狙うキーワード"] as string[]) ?? [];
  const 悩み = (output["ユーザーの悩み"] as string[]) ?? [];
  const 商品サービス = (output["商品サービス"] as Array<Record<string, string>>) ?? [];
  // アンケートは新形式（object）と旧形式（array）両方に対応
  const アンケートRaw = output["アンケート"];
  const アンケートObj: Record<string, unknown> =
    アンケートRaw && !Array.isArray(アンケートRaw) && typeof アンケートRaw === "object"
      ? (アンケートRaw as Record<string, unknown>)
      : {};
  const 質問リスト: Array<Record<string, unknown>> = Array.isArray(アンケートObj["質問リスト"])
    ? (アンケートObj["質問リスト"] as Array<Record<string, unknown>>)
    : Array.isArray(アンケートRaw)
    ? (アンケートRaw as Array<Record<string, unknown>>)
    : [];
  const 提案 = (output["商品サービス提案"] as string[]) ?? [];

  const str = (v: unknown) => (v != null ? String(v) : "");

  rows.push("項目,内容");
  rows.push(row("どの内容を発注しますか？", ""));
  rows.push(row("お客様名", projectName));
  rows.push(row("Googleビジネスプロフィールの開設状況", ""));
  rows.push(row("店舗名（会社名）", ""));
  rows.push(row("店舗（会社）のジャンル", str(output["ジャンル"])));
  rows.push(row("店舗（会社）のご住所", str(基本情報["住所"])));
  rows.push(row("最寄駅", str(output["最寄り駅"])));
  rows.push(row("営業時間", str(基本情報["営業時間"])));
  rows.push(row("会社（店舗）の電話番号", str(基本情報["電話番号"])));
  rows.push(row("提供しているサービス内容やビジネス情報", str(output["店舗説明文"])));
  rows.push(row("打ち出したい強み", 強み.join("、")));
  rows.push(row("狙いたいキーワード", キーワード.join("、")));
  rows.push(row("ターゲットの悩み", 悩み.join("、")));
  rows.push(row("商品配達や出張型サービスは提供していますか？", ""));
  rows.push(row("サービス提供地域", str(基本情報["サービス提供地域"])));
  rows.push(row("特別営業時間", str(基本情報["特別な休み"])));
  rows.push(row("ホームページURL", hpUrl));
  rows.push(row("開業日", str(基本情報["開業日"])));
  rows.push(row("予約フォームURL", ""));

  // 商品・サービス（最大10個）
  商品サービス.slice(0, 10).forEach((item, i) => {
    const n = i + 1;
    rows.push(row(`商品・サービス名（${n}個目）`, str(item["商品サービス名"])));
    rows.push(row(`商品カテゴリ（${n}個目）`, str(item["商品カテゴリ"])));
    rows.push(row(`商品価格（${n}個目）`, str(item["商品価格"]) || "非表示"));
    rows.push(row(`商品の説明（${n}個目）`, str(item["商品説明"])));
  });

  // 商品サービス提案
  if (提案.length > 0) {
    rows.push(row("【商品・サービス提案】", 提案.join("、")));
  }

  // アンケート
  rows.push(row("アンケート名", str(アンケートObj["アンケート名"]) || "お客様アンケート"));
  rows.push(row("口コミ追加キーワード", str(アンケートObj["口コミ追加キーワード"])));
  質問リスト.forEach((q, i) => {
    const 選択肢 = (q["選択肢"] as string[]) ?? [];
    const 質問文 = str(q["質問"] ?? q["カテゴリ"]);
    rows.push(row(`Q${i + 1}. ${質問文}`, 選択肢.join("、")));
  });

  // クーポン・抽選（空欄）
  rows.push(row("クーポン名", ""));
  rows.push(row("抽選ルーレット名", ""));

  // SNS
  rows.push(row("InstagramアカウントURL", ""));
  rows.push(row("TwitterアカウントURL", ""));
  rows.push(row("FacebookアカウントURL", ""));
  rows.push(row("LINE公式アカウントURL", ""));

  return rows.join("\n");
}
