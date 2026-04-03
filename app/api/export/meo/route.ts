import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

const AMBER = "FFFEF3C7"; // 商品・サービス行の背景色
const AMBER_DARK = "FFFDE68A"; // 商品ヘッダー行

function str(v: unknown): string {
  return v != null ? String(v) : "";
}

export async function POST(req: Request) {
  const { output, projectName, hpUrl } = await req.json();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("シート1");

  // 列幅
  sheet.getColumn(1).width = 45;
  sheet.getColumn(2).width = 80;

  function addRow(label: string, value: string, bgColor?: string) {
    const r = sheet.addRow([label, value]);
    r.getCell(1).font = { bold: true, size: 10 };
    r.getCell(2).font = { size: 10 };
    r.getCell(2).alignment = { wrapText: true, vertical: "top" };
    r.getCell(1).alignment = { vertical: "top" };
    if (bgColor) {
      r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
      r.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
    }
  }

  const 基本情報 = (output["基本情報"] as Record<string, string>) ?? {};
  const 強み = (output["強み"] as string[]) ?? [];
  const キーワード = (output["狙うキーワード"] as string[]) ?? [];
  const 悩み = (output["ユーザーの悩み"] as string[]) ?? [];
  const 商品サービス = (output["商品サービス"] as Array<Record<string, string>>) ?? [];
  const 提案 = (output["商品サービス提案"] as string[]) ?? [];

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

  // 基本情報
  addRow("どの内容を発注しますか？", "");
  addRow("お客様名", projectName);
  addRow("Googleビジネスプロフィールの開設状況", "");
  addRow("店舗名（会社名）", "");
  addRow("店舗（会社）のジャンル", str(output["ジャンル"]));
  addRow("店舗（会社）のご住所", str(基本情報["住所"]));
  addRow("最寄駅", str(output["最寄り駅"]));
  addRow("営業時間", str(基本情報["営業時間"]));
  addRow("会社（店舗）の電話番号", str(基本情報["電話番号"]));
  addRow("提供しているサービス内容やビジネス情報", str(output["店舗説明文"]));
  addRow("打ち出したい強み", 強み.join("、"));
  addRow("狙いたいキーワード", キーワード.join("、"));
  addRow("ターゲットの悩み", 悩み.join("、"));
  addRow("商品配達や出張型サービスは提供していますか？", "");
  addRow("サービス提供地域", str(基本情報["サービス提供地域"]));
  addRow("特別営業時間", str(基本情報["特別な休み"]));
  addRow("ホームページURL", hpUrl ?? "");
  addRow("開業日", str(基本情報["開業日"]));
  addRow("予約フォームURL", "");

  // 商品・サービス（アンバー色）
  商品サービス.slice(0, 10).forEach((item, i) => {
    const n = i + 1;
    addRow(`【商品・サービス ${n}個目】商品・サービス名`, str(item["商品サービス名"]), i % 2 === 0 ? AMBER : AMBER_DARK);
    addRow(`【商品・サービス ${n}個目】商品カテゴリ`, str(item["商品カテゴリ"]), i % 2 === 0 ? AMBER : AMBER_DARK);
    addRow(`【商品・サービス ${n}個目】商品価格`, str(item["商品価格"]) || "非表示", i % 2 === 0 ? AMBER : AMBER_DARK);
    addRow(`【商品・サービス ${n}個目】商品の説明`, str(item["商品説明"]), i % 2 === 0 ? AMBER : AMBER_DARK);
  });

  // 商品サービス提案（アンバー色）
  if (提案.length > 0) {
    addRow("【商品・サービス提案】", 提案.join("、"), AMBER);
  }

  // アンケート
  addRow("アンケート名", str(アンケートObj["アンケート名"]) || "お客様アンケート");
  addRow("口コミ追加キーワード", str(アンケートObj["口コミ追加キーワード"]));
  質問リスト.forEach((q, i) => {
    const 選択肢 = (q["選択肢"] as string[]) ?? [];
    const 質問文 = str(q["質問"] ?? q["カテゴリ"]);
    addRow(`Q${i + 1}. ${質問文}`, 選択肢.join("、"));
  });

  // クーポン・SNS
  addRow("クーポン名", "");
  addRow("抽選ルーレット名", "");
  addRow("InstagramアカウントURL", "");
  addRow("TwitterアカウントURL", "");
  addRow("FacebookアカウントURL", "");
  addRow("LINE公式アカウントURL", "");

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(projectName)}_MEO.xlsx`,
    },
  });
}
