"use client";

import { useEffect, useState } from "react";
import OutputTable, { type SelectedTarget } from "./OutputTable";

interface Field { rn: number; section: string; label: string; condition?: string; }

interface Props {
  instanceKey: string;
  label: string;
  theme?: string;
  rows: Record<number | string, string>;
  projectType: string;
  sheetName: string;
  selectedTarget?: SelectedTarget | null;
  onSelectField?: (target: SelectedTarget) => void;
}

export default function HpPageCard({ instanceKey, label, theme, rows, projectType, sheetName, selectedTarget, onSelectField }: Props) {
  const [fields, setFields] = useState<Field[]>([]);

  useEffect(() => {
    fetch(`/api/hp-fields?type=${encodeURIComponent(projectType)}&sheetName=${encodeURIComponent(sheetName)}`)
      .then((r) => r.json())
      .then((data: { fields: Field[] }) => setFields(data.fields))
      .catch(() => {});
  }, [projectType, sheetName]);

  const outputMap: Record<string, string> = {};
  for (const [rn, value] of Object.entries(rows)) {
    if (value) outputMap[rn] = String(value);
  }

  const selectedRn = selectedTarget?.instanceKey === instanceKey ? selectedTarget.rn : undefined;

  const handleSelectRow = (rn: number, section: string, fieldLabel: string, value: string) => {
    onSelectField?.({
      instanceKey,
      pageLabel: label,
      rn,
      section,
      label: fieldLabel,
      currentValue: value,
      displayText: `${label} › [${section}] ${fieldLabel}`,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-gray-800 text-sm shrink-0">{label}</h3>
        {theme && (
          <span className="text-xs text-gray-500 truncate">{theme}</span>
        )}
      </div>
      {fields.length > 0 ? (
        <OutputTable
          fields={fields}
          output={outputMap}
          selectedRn={selectedRn}
          onSelectRow={onSelectField ? handleSelectRow : undefined}
        />
      ) : (
        <div className="p-5 space-y-1.5">
          {Object.entries(rows)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([rowNum, value]) =>
              value ? (
                <div key={rowNum} className="flex gap-3 text-sm">
                  <span className="text-gray-300 w-8 shrink-0 text-right">R{rowNum}</span>
                  <span className="text-gray-700">{value}</span>
                </div>
              ) : null
            )}
        </div>
      )}
    </div>
  );
}
