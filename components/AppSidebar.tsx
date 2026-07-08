"use client";

import Link from "next/link";
import { PROJECT_TYPES } from "@/lib/projectTypes";

interface Props {
  selectedType?: string;
  onSelect?: (type: string) => void;
  compact?: boolean;
}

const icons: Record<string, string> = {
  meo: "M",
  "hp-strong": "S",
  "hp-classic": "C",
  "hp-beauty": "B",
  "hp-recruit": "R",
  lp: "L",
  portal: "P",
};

export default function AppSidebar({ selectedType, onSelect, compact = false }: Props) {
  return (
    <aside className={`app-sidebar ${compact ? "app-sidebar-compact" : ""}`}>
      <Link href="/" className="app-brand">
        <span className="app-brand-mark">W</span>
        {!compact && (
          <span>
            <strong>Writing</strong>
            <small>Automation</small>
          </span>
        )}
      </Link>

      {!compact && <p className="app-nav-label">ライティング種別</p>}
      <nav className="app-nav">
        {PROJECT_TYPES.map((type) => {
          const active = selectedType === type.value;
          const content = (
            <>
              <span className="app-nav-icon">{icons[type.value]}</span>
              {!compact && <span>{type.label}</span>}
              {!compact && <span className="app-nav-arrow">›</span>}
            </>
          );

          if (onSelect) {
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => onSelect(type.value)}
                className={`app-nav-item ${active ? "is-active" : ""}`}
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={type.value}
              href={`/projects/type/${type.value}`}
              className={`app-nav-item ${active ? "is-active" : ""}`}
              title={compact ? type.label : undefined}
            >
              {content}
            </Link>
          );
        })}
      </nav>

      {!compact && (
        <div className="app-sidebar-footer">
          <span className="status-dot" />
          Google Drive連携
        </div>
      )}
    </aside>
  );
}
