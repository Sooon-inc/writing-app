"use client";

import { useState } from "react";

interface WritingSectionProps {
  title: string;
  value: unknown;
}

function flattenToText(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "object" && item !== null) {
          return Object.entries(item as Record<string, unknown>)
            .map(([k, v]) => `${k}: ${flattenToText(v)}`)
            .join("\n");
        }
        return String(item);
      })
      .join("\n\n");
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${flattenToText(v)}`)
      .join("\n");
  }
  return String(value);
}

function renderValue(value: unknown, highlight = false): React.ReactNode {
  // Array
  if (Array.isArray(value)) {
    // Array of objects → card per item
    if (value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
      return (
        <div className="space-y-3">
          {value.map((item, i) => (
            <div key={i} className={`border rounded-lg p-3 space-y-2 ${highlight ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-gray-50"}`}>
              {Object.entries(item as Record<string, unknown>).map(([k, v]) => (
                <div key={k}>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {k}
                  </span>
                  <div className="mt-0.5 text-sm text-gray-700">
                    {Array.isArray(v) ? (
                      <ul className="list-disc list-inside space-y-0.5">
                        {(v as unknown[]).map((s, j) => (
                          <li key={j}>{String(s)}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="whitespace-pre-wrap">{String(v)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    }
    // Array of primitives
    return (
      <ul className="list-disc list-inside space-y-1">
        {value.map((item, i) => (
          <li key={i} className="text-gray-700">
            {String(item)}
          </li>
        ))}
      </ul>
    );
  }

  // Plain object → key-value list (recursive)
  if (typeof value === "object" && value !== null) {
    return (
      <dl className="space-y-2">
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => {
          const isComplex = Array.isArray(v) || (typeof v === "object" && v !== null);
          return (
            <div key={k} className={isComplex ? "mb-3" : "flex gap-2"}>
              <dt className="text-gray-500 text-xs font-semibold shrink-0 min-w-[120px]">{k}</dt>
              <dd className={isComplex ? "mt-1 ml-2" : "text-gray-700 text-sm flex-1"}>
                {renderValue(v)}
              </dd>
            </div>
          );
        })}
      </dl>
    );
  }

  // String
  if (typeof value === "string") {
    return <p className="text-gray-700 whitespace-pre-wrap">{value}</p>;
  }

  return <p className="text-gray-700">{String(value)}</p>;
}

export default function WritingSection({ title, value }: WritingSectionProps) {
  const [copied, setCopied] = useState(false);
  const isProduct = title === "商品サービス";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(flattenToText(value));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`rounded-xl border p-5 ${isProduct ? "bg-amber-50 border-amber-300" : "bg-white border-gray-200"}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-semibold ${isProduct ? "text-amber-800" : "text-gray-800"}`}>{title}</h3>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 px-2.5 py-1 rounded-lg transition-colors"
        >
          {copied ? "コピー済" : "コピー"}
        </button>
      </div>
      <div className="text-sm">{renderValue(value, isProduct)}</div>
    </div>
  );
}
