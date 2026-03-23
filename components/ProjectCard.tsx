"use client";

import Link from "next/link";

const typeLabels: Record<string, string> = {
  meo: "MEO",
  "hp-strong": "HP ストロング",
  "hp-classic": "HP クラシック",
  "hp-beauty": "HP ビューティー",
  "hp-recruit": "HP リクルート",
  lp: "LP",
};

const typeColors: Record<string, string> = {
  meo: "bg-blue-100 text-blue-700",
  "hp-strong": "bg-red-100 text-red-700",
  "hp-classic": "bg-amber-100 text-amber-700",
  "hp-beauty": "bg-pink-100 text-pink-700",
  "hp-recruit": "bg-green-100 text-green-700",
  lp: "bg-purple-100 text-purple-700",
};

interface ProjectCardProps {
  id: string;
  name: string;
  type: string;
  updatedAt: string;
  onDelete: (id: string) => void;
}

export default function ProjectCard({
  id,
  name,
  type,
  updatedAt,
  onDelete,
}: ProjectCardProps) {
  const label = typeLabels[type] ?? type;
  const colorClass = typeColors[type] ?? "bg-gray-100 text-gray-700";
  const date = new Date(updatedAt).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/projects/${id}`} className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate hover:text-blue-600 transition-colors">
            {name}
          </h3>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colorClass}`}>
              {label}
            </span>
            <span className="text-xs text-gray-400">{date}</span>
          </div>
        </Link>
        <button
          onClick={() => onDelete(id)}
          className="text-gray-300 hover:text-red-500 transition-colors text-sm"
          title="削除"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
