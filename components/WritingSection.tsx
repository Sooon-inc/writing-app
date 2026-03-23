"use client";

import { useState } from "react";

interface WritingSectionProps {
  title: string;
  value: unknown;
}

function renderValue(value: unknown): React.ReactNode {
  if (Array.isArray(value)) {
    return (
      <ul className="list-disc list-inside space-y-1">
        {value.map((item, i) => (
          <li key={i} className="text-gray-700">
            {typeof item === "object" && item !== null ? (
              <span>
                {Object.entries(item as Record<string, string>)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" / ")}
              </span>
            ) : (
              String(item)
            )}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === "string") {
    return <p className="text-gray-700 whitespace-pre-wrap">{value}</p>;
  }
  return <p className="text-gray-700">{JSON.stringify(value)}</p>;
}

export default function WritingSection({ title, value }: WritingSectionProps) {
  const [copied, setCopied] = useState(false);

  const textToCopy =
    Array.isArray(value)
      ? (value as unknown[])
          .map((item) =>
            typeof item === "object" && item !== null
              ? Object.entries(item as Record<string, string>)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" / ")
              : String(item)
          )
          .join("\n")
      : String(value);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 px-2.5 py-1 rounded-lg transition-colors"
        >
          {copied ? "コピー済" : "コピー"}
        </button>
      </div>
      <div className="text-sm">{renderValue(value)}</div>
    </div>
  );
}
