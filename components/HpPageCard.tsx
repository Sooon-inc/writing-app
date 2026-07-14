"use client";

import { useEffect, useState } from "react";
import OutputTable, { type SelectedTarget } from "./OutputTable";

interface Field { rn: number; section: string; label: string; condition?: string; group?: string; }

interface Props {
  instanceKey: string;
  label: string;
  theme?: string;
  rows: Record<number | string, string>;
  projectType: string;
  sheetName: string;
  selectedTargets?: SelectedTarget[];
  onToggleField?: (target: SelectedTarget) => void;
  onDeleteField?: (target: SelectedTarget) => void;
  onEditField?: (target: SelectedTarget, value: string) => void;
}

export default function HpPageCard({ instanceKey, label, theme, rows, projectType, sheetName, selectedTargets = [], onToggleField, onDeleteField, onEditField }: Props) {
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

  const selectedRns = selectedTargets
    .filter((target) => target.instanceKey === instanceKey && typeof target.rn === "number")
    .map((target) => target.rn as number);

  const makeTarget = (rn: number, section: string, fieldLabel: string, value: string, group?: string): SelectedTarget => ({
    id: `hp:${instanceKey}:${rn}`,
    instanceKey,
    pageLabel: label,
    sheetName,
    rn,
    section,
    label: fieldLabel,
    group,
    currentValue: value,
    displayText: `${label} › [${section}] ${group ? `${group} / ` : ""}${fieldLabel}`,
  });

  const handleToggleRow = (rn: number, section: string, fieldLabel: string, value: string, group?: string) => {
    onToggleField?.(makeTarget(rn, section, fieldLabel, value, group));
  };

  const handleDeleteRow = (rn: number, section: string, fieldLabel: string, value: string, group?: string) => {
    onDeleteField?.(makeTarget(rn, section, fieldLabel, value, group));
  };

  const handleEditRow = (rn: number, section: string, fieldLabel: string, value: string, group?: string) => {
    onEditField?.(makeTarget(rn, section, fieldLabel, value, group), value);
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
          selectedRns={selectedRns}
          onToggleRow={onToggleField ? handleToggleRow : undefined}
          onDeleteRow={onDeleteField ? handleDeleteRow : undefined}
          onEditRow={onEditField ? handleEditRow : undefined}
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
