"use client";

import OutputTable, { type SelectedTarget } from "./OutputTable";
import type { EditableDirectoryItem } from "@/lib/directoryOutput";

interface Props {
  items: EditableDirectoryItem[];
  instanceKey: string;
  selectedTargets?: SelectedTarget[];
  onToggleField?: (target: SelectedTarget) => void;
  onDeleteField?: (target: SelectedTarget) => void;
  onEditField?: (target: SelectedTarget, value: string) => void;
}

export default function DirectoryOutputCard({
  items,
  instanceKey,
  selectedTargets = [],
  onToggleField,
  onDeleteField,
  onEditField,
}: Props) {
  if (items.length === 0) return null;

  const fields = items.flatMap((item) => [
    {
      rn: item.h1Row,
      section: item.label,
      label: "H1（30〜35文字）",
      condition: "必須",
    },
    {
      rn: item.descriptionRow,
      section: item.label,
      label: "ディスクリプション（最大120文字）",
      condition: "必須",
    },
  ]);
  const output = Object.fromEntries(
    items.flatMap((item) => [
      [String(item.h1Row), item.h1],
      [String(item.descriptionRow), item.description],
    ])
  );
  const selectedRns = selectedTargets
    .filter((target) => target.instanceKey === instanceKey && typeof target.rn === "number")
    .map((target) => target.rn as number);

  const findItem = (rn: number) =>
    items.find((item) => item.h1Row === rn || item.descriptionRow === rn);

  const makeTarget = (
    rn: number,
    section: string,
    fieldLabel: string,
    value: string
  ): SelectedTarget => {
    const item = findItem(rn);
    return {
      id: `directory:${instanceKey}:${rn}`,
      instanceKey,
      pageLabel: "ディレクトリ",
      sheetName: "ディレクトリ",
      rn,
      section,
      label: fieldLabel,
      currentValue: value,
      displayText: `ディレクトリ › ${item?.label ?? section} › ${fieldLabel}`,
    };
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="font-semibold text-gray-800 text-sm">ディレクトリ</h3>
        <p className="mt-1 text-xs text-gray-500">
          各ページのH1とディスクリプションを、シート出力前に確認・修正できます
        </p>
      </div>
      <OutputTable
        fields={fields}
        output={output}
        selectedRns={selectedRns}
        onToggleRow={onToggleField
          ? (rn, section, label, value) => onToggleField(makeTarget(rn, section, label, value))
          : undefined}
        onDeleteRow={onDeleteField
          ? (rn, section, label, value) => onDeleteField(makeTarget(rn, section, label, value))
          : undefined}
        onEditRow={onEditField
          ? (rn, section, label, value) => onEditField(makeTarget(rn, section, label, value), value)
          : undefined}
      />
    </div>
  );
}
