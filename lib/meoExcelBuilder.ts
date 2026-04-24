import * as ExcelJS from "exceljs";

const BEIGE = "FFFEF3C7"; // 回答セル背景
const HEADER_BG = "FFF5F5F5"; // セクションヘッダー背景

function str(v: unknown): string {
  return v != null ? String(v) : "";
}

export function buildMeoWorkbook(
  output: Record<string, unknown>,
  projectName: string,
  hpUrl: string
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("シート1");

  sheet.getColumn(1).width = 55;
  sheet.getColumn(2).width = 85;

  // 通常フィールド: 1行（ラベル | ベージュ回答）
  function addField(label: string, value: string) {
    const r = sheet.addRow([label, value]);
    r.getCell(1).font = { bold: true, size: 9 };
    r.getCell(1).alignment = { vertical: "top", wrapText: true };
    r.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BEIGE } };
    r.getCell(2).font = { size: 9 };
    r.getCell(2).alignment = { wrapText: true, vertical: "top" };
    r.getCell(1).border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };
    r.getCell(2).border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };
    const lines = value ? value.split("\n").length : 1;
    r.height = Math.max(22, lines * 14);
  }

  // セクションヘッダー行（両列結合）
  function addSectionHeader(text: string) {
    const r = sheet.addRow([text, ""]);
    sheet.mergeCells(r.number, 1, r.number, 2);
    r.getCell(1).font = { bold: true, size: 9, color: { argb: "FF374151" } };
    r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
    r.getCell(1).alignment = { wrapText: true, vertical: "middle" };
    r.getCell(1).border = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
    r.height = 28;
  }

  // 商品フィールド: 2行（ラベル行 + ┗回答行）
  function addProductField(label: string, value: string) {
    // ラベル行
    const labelRow = sheet.addRow([label, ""]);
    labelRow.getCell(1).font = { bold: true, size: 9 };
    labelRow.getCell(1).alignment = { vertical: "top" };
    labelRow.height = 18;

    // ┗ 回答行
    const answerRow = sheet.addRow(["┗", value]);
    answerRow.getCell(1).font = { size: 9 };
    answerRow.getCell(1).alignment = { vertical: "top" };
    answerRow.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BEIGE } };
    answerRow.getCell(2).font = { size: 9 };
    answerRow.getCell(2).alignment = { wrapText: true, vertical: "top" };
    answerRow.getCell(2).border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };
    const lines = value ? value.split("\n").length : 1;
    answerRow.height = Math.max(22, lines * 14);
  }

  const 基本情報 = (output["基本情報"] as Record<string, string>) ?? {};
  const 強み = (output["強み"] as string[]) ?? [];
  const キーワード = (output["狙うキーワード"] as string[]) ?? [];
  const 悩み = (output["ユーザーの悩み"] as string[]) ?? [];
  const 商品サービス = (output["商品サービス"] as Array<Record<string, string>>) ?? [];
  const 提案 = (output["商品サービス提案"] as string[]) ?? [];
  const サービス = (output["サービス"] as Array<Record<string, string>>) ?? [];

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

  // ── 基本情報 ──────────────────────────────
  addField("どの内容を発注しますか？", "");
  addField("お客様名", projectName);
  addField("Googleビジネスプロフィールの開設状況", "");
  addField("店舗名（会社名）", "");
  addField("店舗（会社）のジャンル", str(output["ジャンル"]));
  addField("店舗（会社）のご住所", str(基本情報["住所"]));
  addField("最寄駅", str(output["最寄り駅"]));
  addField("営業時間", str(基本情報["営業時間"]));
  addField("会社（店舗）の電話番号", str(基本情報["電話番号"]));
  addField(
    "提供しているサービス内容やビジネス情報をご入力ください。（100文字〜750文字まで）",
    str(output["店舗説明文"])
  );
  addField("打ち出したい強みをご記載ください。", 強み.join("\n"));
  addField("狙いたいキーワードがあればご記入ください。", キーワード.join("\n"));
  addField("ターゲットの悩みをご記載ください。", 悩み.join("\n"));
  addField("商品配達や出張型サービスは提供していますか？", "");
  addField("（はいの場合）サービス提供地域をご記載ください。", str(基本情報["サービス提供地域"]));
  addField("特別営業時間があればご記載ください。", str(基本情報["特別な休み"]));
  addField("（お持ちの場合）ホームページURL", hpUrl ?? "");
  addField("開業日をご記載ください。", str(基本情報["開業日"]));
  addField("（予約可能であれば）予約フォームのURLをご記載ください。", "");

  // ── サービス（MEO/AIO最適化） ──────────────────
  if (サービス.length > 0) {
    addSectionHeader(
      "推したいサービスがある場合、下記フォーマットと同じように詳細をご記載ください。（最大10個まで）"
    );
    サービス.slice(0, 10).forEach((item) => {
      addProductField("商品名", str(item["サービス名"]));
      addProductField(
        "商品価格：※価格を非表示にしたい場合は「非表示」と入力",
        "非表示"
      );
      addProductField("商品の説明：（300文字まで）", str(item["説明文"]));
    });
  }

  // ── 商品 ──────────────────────────────────
  if (商品サービス.length > 0 || 提案.length > 0) {
    addSectionHeader(
      "推したい商品がある場合、下記フォーマットと同じように詳細をご記載ください。（最大10個まで）"
    );
    商品サービス.slice(0, 10).forEach((item) => {
      addProductField("商品名", str(item["商品サービス名"]));
      addProductField("商品カテゴリ", str(item["商品カテゴリ"]));
      addProductField(
        "商品価格：※価格を非表示にしたい場合は「非表示」と入力",
        str(item["商品価格"]) || "非表示"
      );
      addProductField("商品の説明：（1000文字まで）", str(item["商品説明"]));
    });
  }

  // 商品サービス提案
  if (提案.length > 0) {
    addSectionHeader("【商品・サービス提案（追加可能なサービス）】");
    addField("", 提案.join("\n"));
  }

  // ── アンケート ────────────────────────────
  addSectionHeader(
    "クチコミのためのアンケートの作成を希望する場合、下記フォーマットと同じように詳細をご記載ください。（最大3個まで）"
  );
  addField("アンケート名", str(アンケートObj["アンケート名"]) || "お客様アンケート");
  addField("口コミに含める希望追加キーワード", str(アンケートObj["口コミ追加キーワード"]));
  質問リスト.forEach((q, i) => {
    const 選択肢 = (q["選択肢"] as string[]) ?? [];
    const 質問文 = str(q["質問"] ?? q["カテゴリ"]);
    addField(`Q${i + 1}. ${質問文}`, 選択肢.join("、"));
  });

  // ── サービス（MEO/AIO最適化） ──────────────────
  if (サービス.length > 0) {
    addSectionHeader("【GBPサービス設計（MEO・AIO最適化）】優先度の高い順に10個");
    サービス.slice(0, 10).forEach((item, i) => {
      addProductField(`サービス${i + 1}　サービス名`, str(item["サービス名"]));
      addProductField(`サービス${i + 1}　説明文（300文字前後）`, str(item["説明文"]));
    });
  }

  // ── クーポン・抽選・SNS ────────────────────
  addSectionHeader("クーポンの作成を希望する場合、下記フォーマットと同じように詳細をご記載ください。（最大5個まで）");
  addField("クーポン名", "");
  addSectionHeader("抽選ルーレットの作成を希望する場合、下記フォーマットと同じように詳細をご記載ください。（最大3個まで）");
  addField("抽選ルーレット名", "");
  addField("（お持ちの場合）InstagramアカウントURL", "");
  addField("（お持ちの場合）TwitterアカウントURL", "");
  addField("（お持ちの場合）FacebookアカウントURL", "");
  addField("（お持ちの場合）LINE公式アカウントURL", "");

  return workbook;
}
