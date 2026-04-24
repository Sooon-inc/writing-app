export interface SelectedTarget {
  instanceKey?: string;  // HP: page key / LP: "LP"
  pageLabel?: string;
  rn: number;
  section: string;
  label: string;
  currentValue: string;
  displayText: string;  // e.g. "サービス（A型） › [FVエリア] キャッチコピー"
}

interface Field {
  rn: number;
  section: string;
  label: string;
  condition?: string;
}

interface Props {
  fields: Field[];
  output: Record<string, string>;
  selectedRn?: number;
  onSelectRow?: (rn: number, section: string, label: string, value: string) => void;
}

export default function OutputTable({ fields, output, selectedRn, onSelectRow }: Props) {
  type SectionRow = { rn: number; label: string; condition?: string; value: string; section: string };
  type SectionGroup = { section: string; rows: SectionRow[] };
  const sections: SectionGroup[] = [];

  for (const field of fields) {
    const value = output[field.rn] ?? output[String(field.rn)] ?? "";
    if (!value) continue;
    const last = sections[sections.length - 1];
    const row: SectionRow = { rn: field.rn, label: field.label, condition: field.condition, value, section: field.section };
    if (last && last.section === field.section) {
      last.rows.push(row);
    } else {
      sections.push({ section: field.section, rows: [row] });
    }
  }

  if (sections.length === 0) {
    return <p className="text-gray-400 text-sm p-4">表示できる内容がありません</p>;
  }

  return (
    <div className="divide-y divide-gray-100">
      {sections.map(({ section, rows }) => (
        <div key={section}>
          {section && (
            <div className="bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-500 border-b border-gray-100">
              {section}
            </div>
          )}
          <table className="w-full text-sm">
            <tbody>
              {rows.map(({ rn, label, condition, value, section: rowSection }) => {
                const isSelected = selectedRn === rn;
                return (
                  <tr
                    key={rn}
                    onClick={() => onSelectRow?.(rn, rowSection, label, value)}
                    className={`border-b border-gray-50 last:border-0 transition-colors ${
                      onSelectRow ? "cursor-pointer" : ""
                    } ${isSelected ? "bg-blue-50 ring-1 ring-inset ring-blue-200" : onSelectRow ? "hover:bg-gray-50" : ""}`}
                  >
                    <td className={`py-2 px-3 align-top whitespace-nowrap w-48 shrink-0 ${isSelected ? "bg-blue-50/80" : "bg-gray-50/50"}`}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-gray-700">{label}</span>
                        {condition && condition !== "必須" && (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-1 py-0.5 rounded leading-none">{condition}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-gray-800 align-top whitespace-pre-wrap">
                      {value}
                    </td>
                    {onSelectRow && (
                      <td className="py-2 pr-2 align-top w-6">
                        <span className={`text-[10px] ${isSelected ? "text-blue-500" : "text-transparent group-hover:text-gray-300"}`}>
                          {isSelected ? "✓" : ""}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
