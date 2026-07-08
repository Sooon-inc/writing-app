"use client";

import Link from "next/link";
import { PROJECT_TYPE_LABELS } from "@/lib/projectTypes";

const typeColors: Record<string, string> = {
  meo: "bg-blue-100 text-blue-700",
  "hp-strong": "bg-red-100 text-red-700",
  "hp-classic": "bg-amber-100 text-amber-700",
  "hp-beauty": "bg-pink-100 text-pink-700",
  "hp-recruit": "bg-green-100 text-green-700",
  lp: "bg-purple-100 text-purple-700",
  portal: "bg-cyan-100 text-cyan-700",
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
  const label = PROJECT_TYPE_LABELS[type] ?? type;
  const colorClass = typeColors[type] ?? "bg-gray-100 text-gray-700";
  const date = new Date(updatedAt).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 hover:border-sky-200 hover:shadow-lg hover:shadow-sky-100/60 transition-all">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/projects/${id}`} className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-700 truncate hover:text-sky-600 transition-colors">
            {name}
          </h3>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colorClass}`}>
              {label}
            </span>
            <span className="text-xs text-slate-400">{date}</span>
          </div>
        </Link>
        <button
          onClick={() => onDelete(id)}
          className="w-8 h-8 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors text-sm"
          title="削除"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
