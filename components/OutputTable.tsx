export interface SelectedTarget {
  id: string;
  instanceKey?: string;  // HP: page key / LP: "LP"
  pageLabel?: string;
  fieldKey?: string;     // Portal: output key
  rn?: number;
  section: string;
  label: string;
  currentValue: string;
  displayText: string;  // e.g. "サービス（A型） › [FVエリア] キャッチコピー"
  valueType?: "text" | "boolean" | "array" | "object";
}

interface Field {
  rn: number;
  section: string;
  label: string;
  condition?: string;
  group?: string;
}

interface Props {
  fields: Field[];
  output: Record<string, string>;
  selectedRns?: number[];
  onToggleRow?: (rn: number, section: string, label: string, value: string) => void;
  onDeleteRow?: (rn: number, section: string, label: string, value: string) => void;
  onEditRow?: (rn: number, section: string, label: string, value: string) => void;
}

type SectionRow = { rn: number; label: string; condition?: string; value: string; section: string; group: string };
type SubGroup = { groupName: string; rows: SectionRow[] };
type SectionGroup = { section: string; subGroups: SubGroup[] };

export default function OutputTable({ fields, output, selectedRns = [], onToggleRow, onDeleteRow, onEditRow }: Props) {
  const sections: SectionGroup[] = [];

  for (const field of fields) {
    const value = output[field.rn] ?? output[String(field.rn)] ?? "";
    const isAppendableVirtualRow = field.rn >= 10000;
    if (!value && !isAppendableVirtualRow) continue;
    const row: SectionRow = {
      rn: field.rn,
      label: field.label,
      condition: field.condition,
      value,
      section: field.section,
      group: field.group ?? "",
    };

    const lastSection = sections[sections.length - 1];
    if (!lastSection || lastSection.section !== field.section) {
      sections.push({ section: field.section, subGroups: [{ groupName: row.group, rows: [row] }] });
    } else {
      const lastSub = lastSection.subGroups[lastSection.subGroups.length - 1];
      if (lastSub.groupName === row.group) {
        lastSub.rows.push(row);
      } else {
        lastSection.subGroups.push({ groupName: row.group, rows: [row] });
      }
    }
  }

  if (sections.length === 0) {
    return <p className="text-gray-400 text-sm p-4">表示できる内容がありません</p>;
  }

  return (
    <div className="overflow-hidden">
      <div className="border-b border-gray-300 bg-gray-800 px-4 py-2.5 text-white">
        <p className="text-xs font-semibold">スプレッドシート出力プレビュー</p>
        <p className="mt-0.5 text-[10px] text-gray-300">緑色の出力内容がテンプレートの対応行へ入力されます</p>
      </div>
      <div className="max-h-[720px] overflow-auto">
        <table className="w-full min-w-[620px] border-collapse text-xs md:min-w-[960px]">
          <thead className="sticky top-0 z-10 bg-gray-700 text-white">
            <tr>
              <th className="w-[42px] border border-gray-500 px-2 py-2">選択</th>
              <th className="hidden w-[52px] border border-gray-500 px-2 py-2 md:table-cell">行</th>
              <th className="hidden w-[150px] border border-gray-500 px-3 py-2 text-left md:table-cell">セクション</th>
              <th className="hidden w-[120px] border border-gray-500 px-3 py-2 text-left md:table-cell">グループ</th>
              <th className="w-[64px] border border-gray-500 px-2 py-2">条件</th>
              <th className="w-[190px] border border-gray-500 px-3 py-2 text-left">項目・要素</th>
              <th className="border border-gray-500 px-3 py-2 text-left">出力内容</th>
              <th className="w-[70px] border border-gray-500 px-2 py-2">削除</th>
            </tr>
          </thead>
          <tbody>
            {sections.map(({ section, subGroups }) => {
              const sectionRows = subGroups.flatMap(({ groupName, rows }) =>
                rows.map((row) => ({ ...row, groupName }))
              );
              return sectionRows.map(({ rn, label, condition, value, section: rowSection, groupName }, index) => {
                const isSelected = selectedRns.includes(rn);
                return (
                  <tr
                    key={rn}
                    onMouseDown={(e) => {
                      if (!onToggleRow) return;
                      e.preventDefault();
                      onToggleRow(rn, rowSection, label, value);
                    }}
                    className={`${onToggleRow ? "cursor-pointer" : ""} ${isSelected ? "ring-1 ring-inset ring-blue-400 bg-blue-50/50" : onToggleRow ? "hover:bg-blue-50/40" : ""}`}
                  >
                    <td className="w-[42px] border border-gray-300 bg-white px-2 py-2 text-center">
                      {onToggleRow ? (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onToggleRow(rn, rowSection, label, value);
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600"
                          aria-label={`行${rn}を修正対象に選択`}
                        />
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="hidden border border-gray-300 bg-gray-50 px-2 py-2 text-center text-gray-400 md:table-cell">{rn}</td>
                    {index === 0 && (
                      <td rowSpan={sectionRows.length} className="hidden border border-gray-400 bg-gray-100 px-3 py-3 align-middle font-semibold text-gray-700 md:table-cell">
                        {section}
                      </td>
                    )}
                    <td className="hidden border border-gray-300 bg-gray-50 px-3 py-2 text-gray-500 md:table-cell">{groupName}</td>
                    <td className={`border border-gray-300 px-2 py-2 text-center font-medium ${condition === "必須" ? "text-red-500" : "text-gray-500"}`}>
                      {condition || "-"}
                    </td>
                    <td className="border border-gray-300 bg-gray-50 px-3 py-2 font-medium text-gray-700">{label}</td>
                    <td className={`border border-gray-300 bg-green-50 px-3 py-2 leading-relaxed text-gray-800 ${isSelected ? "bg-blue-50" : ""}`}>
                      {onEditRow ? (
                        <textarea
                          key={`${rn}:${value}`}
                          defaultValue={value}
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => event.stopPropagation()}
                          onBlur={(event) => {
                            const next = event.currentTarget.value;
                            if (next !== value) onEditRow(rn, rowSection, label, next);
                          }}
                          className="min-h-[2.5rem] w-full resize-y rounded-md border border-transparent bg-transparent px-1.5 py-1 leading-relaxed text-gray-800 outline-none hover:border-green-200 focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100"
                          aria-label={`行${rn} ${label}を直接編集`}
                        />
                      ) : (
                        <span className="whitespace-pre-wrap">{value}</span>
                      )}
                    </td>
                    <td className="w-[70px] border border-gray-300 bg-white px-2 py-2 text-center">
                      {onDeleteRow ? (
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteRow(rn, rowSection, label, value);
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
              });
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
