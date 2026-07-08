import * as ExcelJS from "exceljs";
import path from "path";

const MEO_TEMPLATE_PATH = "templates/meo/meo.xlsx";

function str(v: unknown): string {
  return v != null ? String(v) : "";
}

export async function buildMeoWorkbook(
  output: Record<string, unknown>,
  projectName: string,
  hpUrl: string
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(process.cwd(), MEO_TEMPLATE_PATH));

  const sheet = wb.getWorksheet("シート１");
  if (!sheet) throw new Error("MEO template sheet 'シート１' not found");

  function setCell(rn: number, col: number, value: string) {
    const cell = sheet!.getCell(rn, col);
    cell.value = value;
    // Adjust row height based on line count
    const lines = value ? value.split("\n").length : 1;
    const minHeight = sheet!.getRow(rn).height ?? 30;
    sheet!.getRow(rn).height = Math.max(minHeight, lines * 14.5);
  }

  // ── データ取得 ─────────────────────────────────────────────────────────
  const 基本情報 = (output["基本情報"] as Record<string, string>) ?? {};
  const 強み = (output["強み"] as string[]) ?? [];
  const キーワード = (output["狙うキーワード"] as string[]) ?? [];
  const 悩み = (output["ユーザーの悩み"] as string[]) ?? [];
  const 商品サービス = (output["商品サービス"] as Array<Record<string, string>>) ?? [];
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

  // ── 基本情報（R4〜R21）─────────────────────────────────────────────────
  setCell(4, 3, projectName);
  // R5: GBP開設状況 → 空欄のまま
  // R6: 店舗名 → 空欄のまま
  setCell(7, 3, str(output["ジャンル"]));
  setCell(8, 3, str(基本情報["住所"]));
  setCell(9, 3, str(output["最寄り駅"]));
  setCell(10, 3, str(基本情報["営業時間"]));
  setCell(11, 3, str(基本情報["電話番号"]));
  setCell(12, 3, str(output["店舗説明文"]));
  setCell(13, 3, 強み.join("\n\n"));
  setCell(14, 3, キーワード.join("\n\n"));
  setCell(15, 3, 悩み.join("\n\n"));

  // R16: 商品配達・出張サービスの有無
  const hasServiceArea =
    str(基本情報["サービス提供地域"]).trim() !== "" &&
    str(基本情報["サービス提供地域"]) !== "情報なし";
  setCell(16, 3, hasServiceArea ? "はい" : "いいえ");

  setCell(17, 3, str(基本情報["サービス提供地域"]));
  setCell(18, 3, str(基本情報["特別な休み"]));
  setCell(19, 3, hpUrl ?? "");
  setCell(20, 3, str(基本情報["開業日"]));
  // R21: 予約フォームURL → 空欄のまま

  // ── R22: GBPサービス欄（output["サービス"] → サービス名・説明文300字）──
  if (サービス.length > 0) {
    const lines: string[] = [];
    サービス.slice(0, 10).forEach((item, i) => {
      if (i > 0) lines.push("");
      lines.push("商品名");
      lines.push(`┗${str(item["サービス名"])}`);
      lines.push("商品価格： ※価格を非表示にしたい場合は「非表示」と入力");
      lines.push(`┗非表示`);
      lines.push("商品の説明：（300文字まで）");
      lines.push(`┗${str(item["説明文"])}`);
    });
    setCell(22, 3, lines.join("\n"));
  }

  // ── R23: 商品（R23Bフォーマット: 商品名・商品カテゴリ・商品価格・商品の説明700字）──
  if (商品サービス.length > 0) {
    const lines: string[] = [];
    商品サービス.slice(0, 10).forEach((item, i) => {
      if (i > 0) lines.push("");
      lines.push("商品名");
      lines.push(`┗${str(item["商品サービス名"])}`);
      lines.push("商品カテゴリ");
      lines.push(`┗${str(item["商品カテゴリ"])}`);
      lines.push("商品価格： ※価格を非表示にしたい場合は「非表示」と入力");
      lines.push(`┗${str(item["商品価格"]) || "非表示"}`);
      lines.push("商品の説明：（1000文字まで）");
      lines.push(`┗${str(item["商品説明"])}`);
    });
    setCell(23, 3, lines.join("\n"));
  }

  // ── R24: アンケート ────────────────────────────────────────────────────
  if (質問リスト.length > 0) {
    const terminalQ = 質問リスト.find((q) => str(q["質問"]).includes("アンケート回答が終了"));
    const regularQs = 質問リスト.filter((q) => !str(q["質問"]).includes("アンケート回答が終了"));

    const lines: string[] = [
      `・アンケート名：${str(アンケートObj["アンケート名"]) || "お客様アンケート"}`,
      `・口コミに含める希望追加キーワード：${str(アンケートObj["口コミ追加キーワード"])}`,
      `・アンケート項目（Q＆A選択形式、質問数は10個まで）`,
    ];
    for (const q of regularQs) {
      lines.push(str(q["質問"]));
      const 選択肢 = (q["選択肢"] as string[]) ?? [];
      lines.push(選択肢.length > 0 ? 選択肢.join(" / ") : "自由記載");
      lines.push("");
    }
    if (terminalQ) {
      const ans = ((terminalQ["選択肢"] as string[]) ?? ["何もしない"])[0] || "何もしない";
      lines.push("・アンケート回答が終了したらどのようにしますか？以下から選んでください。");
      lines.push(`┗ ${ans}`);
    }
    setCell(24, 3, lines.join("\n"));
  }

  // R25: クーポン → 空欄のまま
  // R26: 抽選 → 空欄のまま
  // R27〜R30: SNS → 空欄のまま

  // R32: ロゴ背景
  setCell(32, 3, "はい");

  return wb;
}
