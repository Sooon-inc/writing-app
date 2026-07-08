import type { SelectedTarget } from "./OutputTable";

interface SurveyQuestion {
  質問?: string;
  選択肢?: string[];
}

interface ProductService {
  商品サービス名?: string;
  商品カテゴリ?: string;
  商品価格?: string;
  商品説明?: string;
}

interface Service {
  サービス名?: string;
  説明文?: string;
}

interface MeoData {
  基本情報?: Record<string, string>;
  最寄り駅?: string;
  ジャンル?: string;
  店舗説明文?: string;
  強み?: string[];
  狙うキーワード?: string[];
  ユーザーの悩み?: string[];
  商品サービス?: ProductService[];
  アンケート?: {
    アンケート名?: string;
    口コミ追加キーワード?: string;
    質問リスト?: SurveyQuestion[];
  };
  サービス?: Service[];
  商品サービス提案?: string[];
}

type MeoValueType = "text" | "array" | "object";

interface MeoPreviewRow {
  rn: number;
  section: string;
  label: string;
  fieldKey?: string;
  value: string;
  condition?: string;
  ideal?: string;
  valueType?: MeoValueType;
}

interface Props {
  output: Record<string, unknown>;
  selectedTargets?: SelectedTarget[];
  onToggleField?: (target: SelectedTarget) => void;
  onDeleteField?: (target: SelectedTarget) => void;
  onEditField?: (target: SelectedTarget, value: unknown) => void;
}

function str(value: unknown): string {
  return value == null ? "" : String(value);
}

function display(value: unknown): string {
  const text = str(value).trim();
  return text ? text : "記載なし";
}

function list(items: unknown): string {
  return Array.isArray(items) && items.length > 0
    ? items.map((item, index) => `${index + 1}. ${str(item)}`).join("\n")
    : "記載なし";
}

function formatServices(items?: Service[]): string {
  if (!items?.length) return "記載なし";
  return items.slice(0, 10).map((item, index) => [
    `${index + 1}. ${str(item.サービス名)}`,
    str(item.説明文),
  ].filter(Boolean).join("\n")).join("\n\n");
}

function formatProductServices(items?: ProductService[]): string {
  if (!items?.length) return "記載なし";
  return items.slice(0, 10).map((item, index) => [
    `${index + 1}. ${str(item.商品サービス名)}`,
    item.商品カテゴリ ? `カテゴリ: ${item.商品カテゴリ}` : "",
    item.商品価格 ? `価格: ${item.商品価格}` : "価格: 非表示",
    str(item.商品説明),
  ].filter(Boolean).join("\n")).join("\n\n");
}

function formatSurvey(survey?: MeoData["アンケート"]): string {
  if (!survey) return "記載なし";
  const lines: string[] = [];
  if (survey.アンケート名) lines.push(`アンケート名: ${survey.アンケート名}`);
  if (survey.口コミ追加キーワード) lines.push(`口コミ追加キーワード: ${survey.口コミ追加キーワード}`);
  if (survey.質問リスト?.length) {
    survey.質問リスト.forEach((q, index) => {
      lines.push("");
      lines.push(`Q${index + 1}. ${str(q.質問)}`);
      if (q.選択肢?.length) lines.push(q.選択肢.join(" / "));
    });
  }
  return lines.join("\n").trim() || "記載なし";
}

function stripNumberPrefix(value: string): string {
  return value.replace(/^\s*\d+[.)．、]\s*/, "").trim();
}

function parseNumberedList(value: string): string[] {
  return value
    .split(/\n+/)
    .map((line) => stripNumberPrefix(line))
    .filter(Boolean);
}

function parseServices(value: string): Service[] {
  const services: Service[] = [];
  for (const block of value.split(/\n{2,}/)) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const serviceName = stripNumberPrefix(lines[0]);
    if (!serviceName) continue;
    services.push({
      サービス名: serviceName,
      説明文: lines.slice(1).join("\n"),
    });
  }
  return services;
}

function parseProductServices(value: string): ProductService[] {
  const products: ProductService[] = [];
  for (const block of value.split(/\n{2,}/)) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const productName = stripNumberPrefix(lines[0]);
    if (!productName) continue;
    const item: ProductService = {
      商品サービス名: productName,
      商品価格: "非表示",
    };
    const descriptionLines: string[] = [];
    for (const line of lines.slice(1)) {
      if (line.startsWith("カテゴリ:")) item.商品カテゴリ = line.replace(/^カテゴリ:\s*/, "").trim();
      else if (line.startsWith("価格:")) item.商品価格 = line.replace(/^価格:\s*/, "").trim() || "非表示";
      else descriptionLines.push(line);
    }
    item.商品説明 = descriptionLines.join("\n");
    products.push(item);
  }
  return products;
}

function parseEditableValue(row: MeoPreviewRow, value: string): unknown {
  if (row.fieldKey === "強み" || row.fieldKey === "狙うキーワード" || row.fieldKey === "ユーザーの悩み") {
    return parseNumberedList(value);
  }
  if (row.fieldKey === "サービス") return parseServices(value);
  if (row.fieldKey === "商品サービス") return parseProductServices(value);
  return value;
}

function buildRows(meo: MeoData): MeoPreviewRow[] {
  const basic = meo.基本情報 ?? {};
  const hasServiceArea =
    str(basic["サービス提供地域"]).trim() !== "" &&
    str(basic["サービス提供地域"]) !== "情報なし";

  return [
    { rn: 7, section: "基本情報", label: "ジャンル", fieldKey: "ジャンル", value: display(meo.ジャンル), condition: "必須", ideal: "-", valueType: "text" },
    { rn: 8, section: "基本情報", label: "住所", fieldKey: "基本情報.住所", value: display(basic["住所"]), condition: "必須", ideal: "-", valueType: "text" },
    { rn: 9, section: "基本情報", label: "最寄り駅", fieldKey: "最寄り駅", value: display(meo.最寄り駅), condition: "任意", ideal: "-", valueType: "text" },
    { rn: 10, section: "基本情報", label: "営業時間", fieldKey: "基本情報.営業時間", value: display(basic["営業時間"]), condition: "必須", ideal: "-", valueType: "text" },
    { rn: 11, section: "基本情報", label: "電話番号", fieldKey: "基本情報.電話番号", value: display(basic["電話番号"]), condition: "必須", ideal: "-", valueType: "text" },
    { rn: 12, section: "店舗説明", label: "店舗説明文", fieldKey: "店舗説明文", value: display(meo.店舗説明文), condition: "必須", ideal: "500〜700", valueType: "text" },
    { rn: 13, section: "訴求設計", label: "強み", fieldKey: "強み", value: list(meo.強み), condition: "必須", ideal: "5件", valueType: "array" },
    { rn: 14, section: "訴求設計", label: "狙うキーワード", fieldKey: "狙うキーワード", value: list(meo.狙うキーワード), condition: "必須", ideal: "5件", valueType: "array" },
    { rn: 15, section: "訴求設計", label: "ユーザーの悩み", fieldKey: "ユーザーの悩み", value: list(meo.ユーザーの悩み), condition: "必須", ideal: "5件", valueType: "array" },
    { rn: 16, section: "基本情報", label: "商品配達・出張サービスの有無", value: hasServiceArea ? "はい" : "いいえ", condition: "必須", ideal: "-", valueType: "text" },
    { rn: 17, section: "基本情報", label: "サービス提供地域", fieldKey: "基本情報.サービス提供地域", value: display(basic["サービス提供地域"]), condition: "必須", ideal: "-", valueType: "text" },
    { rn: 18, section: "基本情報", label: "特別な休み", fieldKey: "基本情報.特別な休み", value: display(basic["特別な休み"]), condition: "任意", ideal: "-", valueType: "text" },
    { rn: 20, section: "基本情報", label: "開業日", fieldKey: "基本情報.開業日", value: display(basic["開業日"]), condition: "任意", ideal: "-", valueType: "text" },
    { rn: 22, section: "GBPサービス欄", label: "サービス", fieldKey: "サービス", value: formatServices(meo.サービス), condition: "必須", ideal: "10件 / 各300字", valueType: "array" },
    { rn: 23, section: "商品欄", label: "商品サービス", fieldKey: "商品サービス", value: formatProductServices(meo.商品サービス), condition: "必須", ideal: "最大10件 / 各700字", valueType: "array" },
    { rn: 24, section: "アンケート", label: "アンケート", fieldKey: "アンケート", value: formatSurvey(meo.アンケート), condition: "必須", ideal: "最大10問", valueType: "object" },
    { rn: 32, section: "ロゴ背景", label: "ロゴ背景", value: "はい", condition: "任意", ideal: "-", valueType: "text" },
  ];
}

export default function MeoOutputDisplay({ output, selectedTargets = [], onToggleField, onDeleteField, onEditField }: Props) {
  const meo = output as MeoData;
  const rows = buildRows(meo);

  const makeTarget = (row: MeoPreviewRow): SelectedTarget | null => {
    if (!row.fieldKey) return null;
    return {
      id: `meo:${row.fieldKey}`,
      instanceKey: "MEO",
      fieldKey: row.fieldKey,
      pageLabel: "MEO",
      rn: row.rn,
      section: row.section,
      label: row.label,
      currentValue: row.value,
      displayText: `MEO › [${row.section}] ${row.label}`,
      valueType: row.valueType,
    };
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-300 bg-gray-800 px-4 py-3 text-white">
        <div>
          <h3 className="text-sm font-semibold">スプレッドシート出力プレビュー</h3>
          <p className="mt-0.5 text-xs text-gray-300">緑色の出力内容がMEOテンプレートの対応行へ入力されます</p>
        </div>
        <span className="rounded bg-green-600 px-2 py-1 text-xs font-medium">シート１</span>
      </div>
      <div className="max-h-[760px] overflow-auto">
        <table className="w-full min-w-[720px] border-collapse text-xs md:min-w-[1060px]">
          <thead className="sticky top-0 z-10 bg-gray-700 text-white">
            <tr>
              <th className="w-[42px] border border-gray-500 px-2 py-2">選択</th>
              <th className="w-[52px] border border-gray-500 px-2 py-2">行</th>
              <th className="w-[150px] border border-gray-500 px-3 py-2 text-left">セクション</th>
              <th className="w-[64px] border border-gray-500 px-2 py-2">条件</th>
              <th className="w-[190px] border border-gray-500 px-3 py-2 text-left">項目・要素</th>
              <th className="border border-gray-500 px-3 py-2 text-left">出力内容</th>
              <th className="w-[120px] border border-gray-500 px-2 py-2">理想文字数</th>
              <th className="w-[70px] border border-gray-500 px-2 py-2">削除</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const target = makeTarget(row);
              const isSelected = !!target && selectedTargets.some((item) => item.id === target.id);
              return (
                <tr
                  key={`${row.rn}-${row.label}`}
                  onMouseDown={(e) => {
                    if (!target) return;
                    e.preventDefault();
                    onToggleField?.(target);
                  }}
                  className={`align-top ${target ? "cursor-pointer hover:bg-blue-50/40" : ""} ${isSelected ? "ring-1 ring-inset ring-blue-400 bg-blue-50/50" : ""}`}
                >
                  <td className="border border-gray-300 bg-white px-2 py-2 text-center">
                    {target ? (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onToggleField?.(target);
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                        aria-label={`行${row.rn} ${row.label}を修正対象に選択`}
                      />
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="border border-gray-300 bg-gray-50 px-2 py-2 text-center text-gray-400">{row.rn}</td>
                  <td className="border border-gray-300 bg-gray-100 px-3 py-2 font-semibold text-gray-700">{row.section}</td>
                  <td className={`border border-gray-300 px-2 py-2 text-center font-medium ${row.condition === "必須" ? "text-red-500" : "text-gray-500"}`}>{row.condition ?? "-"}</td>
                  <td className="border border-gray-300 bg-gray-50 px-3 py-2 font-medium text-gray-700">{row.label}</td>
                  <td className={`border border-gray-300 bg-green-50 px-3 py-2 leading-relaxed text-gray-800 ${isSelected ? "bg-blue-50" : ""}`}>
                    {target && onEditField && row.valueType !== "object" ? (
                      <textarea
                        key={`${row.fieldKey}:${row.value}`}
                        defaultValue={row.value}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                        onBlur={(event) => {
                          const next = event.currentTarget.value;
                          if (next !== row.value) onEditField(target, parseEditableValue(row, next));
                        }}
                        className="min-h-[2.5rem] w-full resize-y rounded-md border border-transparent bg-transparent px-1.5 py-1 leading-relaxed text-gray-800 outline-none hover:border-green-200 focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100"
                        aria-label={`${row.label}を直接編集`}
                      />
                    ) : (
                      <span className="whitespace-pre-wrap">{row.value}</span>
                    )}
                  </td>
                  <td className="border border-gray-300 bg-gray-50 px-2 py-2 text-center text-gray-500">{row.ideal ?? "-"}</td>
                  <td className="border border-gray-300 bg-white px-2 py-2 text-center">
                    {target ? (
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteField?.(target);
                        }}
                        className="rounded border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50"
                      >
                        削除
                      </button>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
