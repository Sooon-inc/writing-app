import type { SelectedTarget } from "./OutputTable";

interface PortalSheetPreviewProps {
  output: Record<string, unknown>;
  selectedTargets?: SelectedTarget[];
  onToggleField?: (target: SelectedTarget) => void;
  onDeleteField?: (target: SelectedTarget) => void;
  onEditField?: (target: SelectedTarget, value: string) => void;
}

interface PreviewRow {
  label: string;
  key?: string;
  condition?: string;
  ideal?: string;
  placeholder?: string;
  tag?: boolean;
}

interface PreviewSection {
  page: "トップページ" | "詳細ページ";
  section: string;
  note?: string;
  rows: PreviewRow[];
}

const COMPANY_ROWS: PreviewRow[] = [
  { label: "会社名", key: "会社名", condition: "必須", ideal: "-" },
  { label: "アイコン", condition: "必須", placeholder: "ロゴ・アイコン画像", ideal: "画像" },
  { label: "Google口コミ（Place ID）", key: "Google口コミ（Place ID）", condition: "必須", ideal: "-" },
  { label: "郵便番号", key: "郵便番号", condition: "必須", ideal: "-" },
  { label: "住所", key: "住所", condition: "必須", ideal: "-" },
  { label: "GoogleMap用住所（iframe）", key: "GoogleMap用住所", condition: "必須", ideal: "-" },
  { label: "創業", key: "創業", condition: "任意", ideal: "-" },
  { label: "保有資格", key: "保有資格", condition: "任意", ideal: "-" },
  { label: "最寄りの駅", key: "最寄りの駅", condition: "任意", ideal: "-" },
  { label: "営業時間", key: "営業時間", condition: "任意", ideal: "-" },
  { label: "電話番号", key: "電話番号", condition: "任意", ideal: "-" },
  { label: "事業内容", key: "事業内容", condition: "任意", ideal: "-" },
  { label: "店舗イメージ", condition: "必須", placeholder: "画像は1枚以上、最大5枚まで", ideal: "画像" },
  { label: "❹ 中見出し", key: "会社紹介❹中見出し", condition: "必須", ideal: "15〜45" },
  { label: "❹ 本文", key: "会社紹介❹本文", condition: "必須", ideal: "100〜250" },
  { label: "❺ 中見出し", key: "会社紹介❺中見出し", condition: "必須", ideal: "15〜45" },
  { label: "❺ 本文", key: "会社紹介❺本文", condition: "必須", ideal: "100〜250" },
  { label: "❻ 中見出し", key: "会社紹介❻中見出し", condition: "任意", ideal: "15〜45" },
  { label: "❻ 本文", key: "会社紹介❻本文", condition: "任意", ideal: "100〜250" },
  { label: "Instagram", key: "Instagram", condition: "任意", ideal: "-" },
  { label: "X（Twitter）", key: "X（Twitter）", condition: "任意", ideal: "-" },
  { label: "LINE公式", key: "LINE公式", condition: "任意", ideal: "-" },
  { label: "YouTube", key: "YouTube", condition: "任意", ideal: "-" },
  { label: "公式サイト", key: "公式サイト", condition: "任意", ideal: "-" },
  { label: "緯度（現在地から探すに使用）", key: "緯度", condition: "任意", ideal: "-" },
  { label: "経度（現在地から探すに使用）", key: "経度", condition: "任意", ideal: "-" },
  { label: "❹ 本文（詳細）", key: "詳細紹介❹本文", condition: "任意", ideal: "150〜350" },
  { label: "❺ 中見出し（詳細）", key: "詳細紹介❺中見出し", condition: "任意", ideal: "15〜45" },
  { label: "❺ 本文（詳細）", key: "詳細紹介❺本文", condition: "任意", ideal: "150〜350" },
  { label: "❻ 中見出し（詳細）", key: "詳細紹介❻中見出し", condition: "任意", ideal: "15〜45" },
  { label: "❻ 本文（詳細）", key: "詳細紹介❻本文", condition: "任意", ideal: "150〜350" },
];

function caseRows(index: "①" | "②" | "③", required: boolean): PreviewRow[] {
  return [
    { label: `${index} タグ（カンマ区切り）`, key: `施工事例${index}タグ`, condition: required ? "必須" : "任意", ideal: "-" },
    { label: `${index} Before／After画像`, condition: "任意", placeholder: "After画像のみでも可", ideal: "画像" },
    { label: `${index} 価格（〜万円表示）`, key: `施工事例${index}価格`, condition: "任意", ideal: "数値のみ" },
    { label: `${index} 工期`, key: `施工事例${index}工期`, condition: "任意", ideal: "-" },
    { label: `${index} 所在地（市区町村）`, key: `施工事例${index}所在地`, condition: "任意", ideal: "-" },
  ];
}

const BASE_SECTIONS: PreviewSection[] = [
  {
    page: "トップページ",
    section: "注目の掲載店",
    rows: [{ label: "見出し", key: "注目の掲載店見出し", condition: "必須", ideal: "-" }],
  },
  { page: "詳細ページ", section: "会社情報", rows: COMPANY_ROWS },
  {
    page: "詳細ページ",
    section: "施工事例・実績",
    note: "画像欄はExcel出力後に追加します",
    rows: [...caseRows("①", true), ...caseRows("②", false), ...caseRows("③", false)],
  },
  {
    page: "詳細ページ",
    section: "3つのお約束",
    rows: [
      { label: "① 見出し", key: "お約束①見出し", condition: "必須", ideal: "-" },
      { label: "① 本文", key: "お約束①本文", condition: "必須", ideal: "-" },
      { label: "② 見出し", key: "お約束②見出し", condition: "必須", ideal: "-" },
      { label: "② 本文", key: "お約束②本文", condition: "必須", ideal: "-" },
      { label: "③ 見出し", key: "お約束③見出し", condition: "必須", ideal: "-" },
      { label: "③ 本文", key: "お約束③本文", condition: "必須", ideal: "-" },
    ],
  },
  {
    page: "詳細ページ",
    section: "代表インタビュー",
    rows: [1, 2, 3, 4, 5].flatMap((index) => {
      const number = ["", "①", "②", "③", "④", "⑤"][index];
      return [
        { label: `${number} 質問`, key: `インタビュー${number}質問`, condition: "必須", ideal: "-" },
        { label: `${number} 回答`, key: `インタビュー${number}回答`, condition: "必須", ideal: "-" },
        { label: `${number} 画像`, condition: "任意", placeholder: "インタビュー画像", ideal: "画像" },
      ];
    }),
  },
  {
    page: "詳細ページ",
    section: "対応エリア",
    rows: [{ label: "都道府県", key: "対応エリア", condition: "必須", ideal: "-" }],
  },
  {
    page: "詳細ページ",
    section: "タグ",
    rows: ["水まわり", "内装", "外壁・屋根", "外構・エクステリア", "マンション", "戸建て", "耐震・断熱", "店舗・オフィス"].map((tag) => ({
      label: tag,
      key: `タグ_${tag}`,
      condition: "必須",
      ideal: "-",
      tag: true,
    })),
  },
];

function hasText(value: unknown): boolean {
  const text = String(value ?? "").trim();
  return text !== "" && text !== "記載なし";
}

function displayValue(row: PreviewRow, output: Record<string, unknown>): string {
  if (!row.key) return row.placeholder ?? "";
  const value = output[row.key];
  if (row.tag) return value === true || String(value).toLowerCase() === "true" ? "☑  該当" : "☐  非該当";
  return hasText(value) ? String(value) : "記載なし";
}

export default function PortalSheetPreview({ output, selectedTargets = [], onToggleField, onDeleteField, onEditField }: PortalSheetPreviewProps) {
  const additionalRows: PreviewRow[] = [1, 2, 3].flatMap((index) => {
    const number = ["", "①", "②", "③"][index];
    const questionKey = `追加質問${number}`;
    const answerKey = `追加回答${number}`;
    if (!hasText(output[questionKey]) || !hasText(output[answerKey])) return [];
    return [
      { label: `${index + 5} 質問`, key: questionKey, condition: "任意", ideal: "-" },
      { label: `${index + 5} 回答`, key: answerKey, condition: "任意", ideal: "-" },
    ];
  });

  const sections = additionalRows.length > 0
    ? [...BASE_SECTIONS.slice(0, 5), { page: "詳細ページ" as const, section: "代表インタビュー（追加）", rows: additionalRows }, ...BASE_SECTIONS.slice(5)]
    : BASE_SECTIONS;

  const makeTarget = (section: PreviewSection, row: PreviewRow): SelectedTarget | null => {
    if (!row.key) return null;
    return {
      id: `portal:${row.key}`,
      instanceKey: "PORTAL",
      fieldKey: row.key,
      pageLabel: "ポータルサイト",
      section: section.section,
      label: row.label,
      currentValue: displayValue(row, output),
      displayText: `ポータルサイト › [${section.section}] ${row.label}`,
      valueType: row.tag ? "boolean" : "text",
    };
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-300 bg-gray-800 px-4 py-3 text-white">
        <div>
          <h3 className="text-sm font-semibold">スプレッドシート出力プレビュー</h3>
          <p className="mt-0.5 text-xs text-gray-300">緑色の「本文（G列）」がExcel・Googleスプレッドシートへ入力されます</p>
        </div>
        <span className="rounded bg-green-600 px-2 py-1 text-xs font-medium">記事シート</span>
      </div>
      <div className="max-h-[760px] overflow-auto">
        <table className="w-full min-w-[620px] border-collapse text-xs md:min-w-[980px]">
          <thead className="sticky top-0 z-10 bg-gray-700 text-white">
            <tr>
              <th className="w-[42px] border border-gray-500 px-2 py-2">選択</th>
              <th className="hidden w-[68px] border border-gray-500 px-2 py-2 md:table-cell">ページ</th>
              <th className="hidden w-[160px] border border-gray-500 px-3 py-2 text-left md:table-cell">セクション</th>
              <th className="w-[64px] border border-gray-500 px-2 py-2">条件</th>
              <th className="w-[190px] border border-gray-500 px-3 py-2 text-left">項目・要素</th>
              <th className="border border-gray-500 px-3 py-2 text-left">本文（G列）</th>
              <th className="w-[90px] border border-gray-500 px-2 py-2">理想文字数</th>
              <th className="w-[70px] border border-gray-500 px-2 py-2">削除</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => section.rows.map((row, rowIndex) => {
              const target = makeTarget(section, row);
              const isSelected = !!target && selectedTargets.some((item) => item.id === target.id);
              const canEdit = !!target;
              const displayedValue = displayValue(row, output);
              const canDirectEdit = !!target && !row.tag && !row.placeholder;
              return (
                <tr
                  key={`${section.section}-${row.label}`}
                  onMouseDown={(e) => {
                    if (target) onToggleField?.(target);
                    if (target) e.preventDefault();
                  }}
                  className={`align-top ${canEdit ? "cursor-pointer hover:bg-blue-50/40" : ""} ${isSelected ? "ring-1 ring-inset ring-blue-400 bg-blue-50/50" : ""}`}
                >
                  <td className="w-[42px] border border-gray-300 bg-white px-2 py-2 text-center">
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
                        aria-label={`${row.label}を修正対象に選択`}
                      />
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  {rowIndex === 0 && (
                    <>
                      <td rowSpan={section.rows.length} className="hidden border border-gray-400 bg-red-600 px-2 py-3 text-center font-semibold text-white [writing-mode:vertical-rl] md:table-cell">
                        {section.page}
                      </td>
                      <td rowSpan={section.rows.length} className="hidden border border-gray-400 bg-white px-3 py-3 align-middle md:table-cell">
                        <p className="font-semibold text-gray-800">{section.section}</p>
                        {section.note && <p className="mt-1 text-[10px] leading-relaxed text-gray-500">{section.note}</p>}
                      </td>
                    </>
                  )}
                  <td className={`border border-gray-300 px-2 py-2 text-center font-medium ${row.condition === "必須" ? "text-red-500" : "text-gray-500"}`}>
                    {row.condition}
                  </td>
                  <td className="border border-gray-300 bg-gray-50 px-3 py-2 font-medium text-gray-700">{row.label}</td>
                  <td className={`border border-gray-300 px-3 py-2 leading-relaxed ${row.placeholder ? "bg-green-100 text-gray-500" : "bg-green-50 text-gray-800"} ${isSelected ? "bg-blue-50" : ""}`}>
                    {canDirectEdit && onEditField ? (
                      <textarea
                        key={`${row.key}:${displayedValue}`}
                        defaultValue={displayedValue}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                        onBlur={(event) => {
                          const next = event.currentTarget.value;
                          if (next !== displayedValue) onEditField(target, next);
                        }}
                        className="min-h-[2.5rem] w-full resize-y rounded-md border border-transparent bg-transparent px-1.5 py-1 leading-relaxed text-gray-800 outline-none hover:border-green-200 focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100"
                        aria-label={`${row.label}を直接編集`}
                      />
                    ) : (
                      <span className="whitespace-pre-wrap">{displayedValue}</span>
                    )}
                  </td>
                  <td className="border border-gray-300 bg-gray-50 px-2 py-2 text-center text-gray-500">{row.ideal}</td>
                  <td className="w-[70px] border border-gray-300 bg-white px-2 py-2 text-center">
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
            }))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
