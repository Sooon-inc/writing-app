import * as ExcelJS from "exceljs";
import path from "path";

export const PORTAL_TEMPLATE_PATH = "templates/portal/portal.xlsx";

const TEXT_ROW_MAP: Record<string, number> = {
  "注目の掲載店見出し": 5,
  "会社名": 7,
  "Google口コミ（Place ID）": 9,
  "郵便番号": 10,
  "住所": 11,
  "GoogleMap用住所": 12,
  "創業": 13,
  "保有資格": 14,
  "最寄りの駅": 15,
  "営業時間": 16,
  "電話番号": 17,
  "事業内容": 18,
  "会社紹介❹中見出し": 20,
  "会社紹介❹本文": 21,
  "会社紹介❺中見出し": 22,
  "会社紹介❺本文": 23,
  "会社紹介❻中見出し": 24,
  "会社紹介❻本文": 25,
  "Instagram": 26,
  "X（Twitter）": 27,
  "LINE公式": 28,
  "YouTube": 29,
  "公式サイト": 30,
  "緯度": 31,
  "経度": 32,
  "詳細紹介❹本文": 33,
  "詳細紹介❺中見出し": 34,
  "詳細紹介❺本文": 35,
  "詳細紹介❻中見出し": 36,
  "詳細紹介❻本文": 37,
  "施工事例①タグ": 38,
  "施工事例①価格": 40,
  "施工事例①工期": 41,
  "施工事例①所在地": 42,
  "施工事例②タグ": 43,
  "施工事例②価格": 45,
  "施工事例②工期": 46,
  "施工事例②所在地": 47,
  "施工事例③タグ": 48,
  "施工事例③価格": 50,
  "施工事例③工期": 51,
  "施工事例③所在地": 52,
  "お約束①見出し": 53,
  "お約束①本文": 54,
  "お約束②見出し": 55,
  "お約束②本文": 56,
  "お約束③見出し": 57,
  "お約束③本文": 58,
  "インタビュー①質問": 59,
  "インタビュー①回答": 60,
  "インタビュー②質問": 62,
  "インタビュー②回答": 63,
  "インタビュー③質問": 65,
  "インタビュー③回答": 66,
  "インタビュー④質問": 68,
  "インタビュー④回答": 69,
  "インタビュー⑤質問": 71,
  "インタビュー⑤回答": 72,
  "対応エリア": 74,
};

const TAG_ROW_MAP: Record<string, number> = {
  "タグ_水まわり": 75,
  "タグ_内装": 76,
  "タグ_外壁・屋根": 77,
  "タグ_外構・エクステリア": 78,
  "タグ_マンション": 79,
  "タグ_戸建て": 80,
  "タグ_耐震・断熱": 81,
  "タグ_店舗・オフィス": 82,
};

function text(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function isMeaningful(value: unknown): boolean {
  const valueText = text(value);
  return valueText !== "" && valueText !== "記載なし" && valueText !== "なし";
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return /^(true|1|yes|該当|あり|有|○|〇|✓)$/i.test(text(value));
}

function cloneStyle(style: Partial<ExcelJS.Style>): Partial<ExcelJS.Style> {
  return JSON.parse(JSON.stringify(style)) as Partial<ExcelJS.Style>;
}

function addAdditionalInterviews(
  sheet: ExcelJS.Worksheet,
  output: Record<string, unknown>
): number {
  const additions = [1, 2, 3]
    .map((index) => ({
      question: text(output[`追加質問${["", "①", "②", "③"][index]}`]),
      answer: text(output[`追加回答${["", "①", "②", "③"][index]}`]),
    }))
    .filter(({ question, answer }) => isMeaningful(question) && isMeaningful(answer));

  if (additions.length === 0) return 0;

  const firstRow = 74;
  const insertedRowCount = additions.length * 2;
  const lastRow = firstRow + additions.length * 2 - 1;

  // 5問目の直後へ行を挿入する。挿入位置をまたぐ結合セルは一度解除し、
  // 対応エリア・タグを下へ移動した位置で再構築する。
  for (const range of [
    "A7:A82",
    "N60:S74",
    "D74:F74",
    "G74:K74",
    "B75:B82",
    "C75:C82",
    "D75:F82",
  ]) {
    sheet.unMergeCells(range);
  }
  sheet.spliceRows(74, 0, ...Array.from({ length: insertedRowCount }, () => []));

  sheet.mergeCells(`A7:A${82 + insertedRowCount}`);
  sheet.mergeCells(`N60:S${74 + insertedRowCount}`);
  sheet.mergeCells(`D${74 + insertedRowCount}:F${74 + insertedRowCount}`);
  sheet.mergeCells(`G${74 + insertedRowCount}:K${74 + insertedRowCount}`);
  sheet.mergeCells(`B${75 + insertedRowCount}:B${82 + insertedRowCount}`);
  sheet.mergeCells(`C${75 + insertedRowCount}:C${82 + insertedRowCount}`);
  sheet.mergeCells(`D${75 + insertedRowCount}:F${82 + insertedRowCount}`);

  for (let index = 0; index < additions.length; index += 1) {
    const questionRowNumber = firstRow + index * 2;
    const answerRowNumber = questionRowNumber + 1;
    const displayNumber = 6 + index;

    for (const [targetRowNumber, sourceRowNumber] of [
      [questionRowNumber, 71],
      [answerRowNumber, 72],
    ] as const) {
      const sourceRow = sheet.getRow(sourceRowNumber);
      const targetRow = sheet.getRow(targetRowNumber);
      targetRow.height = sourceRow.height;
      for (let column = 1; column <= 12; column += 1) {
        targetRow.getCell(column).style = cloneStyle(sourceRow.getCell(column).style);
      }
    }

    sheet.mergeCells(`D${questionRowNumber}:F${questionRowNumber}`);
    sheet.mergeCells(`G${questionRowNumber}:K${questionRowNumber}`);
    sheet.mergeCells(`D${answerRowNumber}:F${answerRowNumber}`);
    sheet.mergeCells(`G${answerRowNumber}:K${answerRowNumber}`);
    sheet.getCell(`D${questionRowNumber}`).value = `${displayNumber}質問`;
    sheet.getCell(`G${questionRowNumber}`).value = additions[index].question;
    sheet.getCell(`D${answerRowNumber}`).value = `${displayNumber}回答`;
    sheet.getCell(`G${answerRowNumber}`).value = additions[index].answer;
    sheet.getCell(`L${questionRowNumber}`).value = "-";
    sheet.getCell(`L${answerRowNumber}`).value = "-";
  }

  sheet.mergeCells(`B${firstRow}:B${lastRow}`);
  sheet.mergeCells(`C${firstRow}:C${lastRow}`);

  const labelCell = sheet.getCell(`B${firstRow}`);
  labelCell.value = "代表インタビュー（追加）";
  labelCell.font = { bold: true, size: 9 };
  labelCell.alignment = { vertical: "middle", wrapText: true };

  const conditionCell = sheet.getCell(`C${firstRow}`);
  conditionCell.value = "任意";
  conditionCell.font = { color: { argb: "FFFF0000" }, size: 9 };
  conditionCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  return insertedRowCount;
}

export async function buildPortalWorkbook(
  output: Record<string, unknown>
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(process.cwd(), PORTAL_TEMPLATE_PATH));

  const sheet = workbook.getWorksheet("記事");
  if (!sheet) throw new Error("ポータルテンプレートの「記事」シートが見つかりません");

  const insertedRowCount = addAdditionalInterviews(sheet, output);

  for (const [key, rowNumber] of Object.entries(TEXT_ROW_MAP)) {
    const value = text(output[key]);
    const targetRow = rowNumber >= 74 ? rowNumber + insertedRowCount : rowNumber;
    if (value) sheet.getCell(`G${targetRow}`).value = value;
  }

  for (const [key, rowNumber] of Object.entries(TAG_ROW_MAP)) {
    sheet.getCell(`G${rowNumber + insertedRowCount}`).value = toBoolean(output[key]);
  }
  return workbook;
}
