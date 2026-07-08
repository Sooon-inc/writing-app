"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppSidebar from "@/components/AppSidebar";
import ProjectCard from "@/components/ProjectCard";
import { PROJECT_TYPES, PROJECT_TYPE_LABELS } from "@/lib/projectTypes";

interface Project {
  id: string;
  name: string;
  type: string;
  updatedAt: string;
}

export default function HomePage() {
  const [selectedType, setSelectedType] = useState("meo");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  const visibleProjects = useMemo(
    () => projects.filter((project) => project.type === selectedType),
    [projects, selectedType]
  );

  const handleDelete = async (id: string) => {
    if (!confirm("この案件を削除しますか？")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setProjects((prev) => prev.filter((project) => project.id !== id));
  };

  const selected = PROJECT_TYPES.find((type) => type.value === selectedType);

  return (
    <main className="app-shell">
      <AppSidebar selectedType={selectedType} onSelect={setSelectedType} />

      <section className="dashboard-main">
        <header className="flex flex-wrap items-start justify-between gap-4 mb-7">
          <div>
            <p className="text-[11px] font-bold tracking-[0.18em] text-sky-500 mb-2">WRITING DASHBOARD</p>
            <h1 className="text-2xl font-bold text-slate-700">ライティング案件</h1>
            <p className="text-sm text-slate-400 mt-1">
              左のメニューから種別を選ぶと、案件がここに表示されます
            </p>
          </div>
          <div className="dashboard-card px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-500 grid place-items-center font-bold">
              {visibleProjects.length}
            </div>
            <div>
              <p className="text-[10px] text-slate-400">登録案件</p>
              <p className="text-sm font-semibold text-slate-600">{PROJECT_TYPE_LABELS[selectedType]}</p>
            </div>
          </div>
        </header>

        <div className="dashboard-card overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-300 text-white grid place-items-center font-bold shadow-md shadow-sky-100">
                {selected?.label.slice(0, 1)}
              </span>
              <div>
                <h2 className="font-bold text-slate-700">{selected?.label}</h2>
                <p className="text-xs text-slate-400">案件一覧</p>
              </div>
            </div>
            <Link
              href={`/projects/new?type=${encodeURIComponent(selectedType)}`}
              className="soft-button px-4 py-2.5 text-sm font-semibold"
            >
              ＋ 新規作成
            </Link>
          </div>

          <div className="p-6 bg-slate-50/40 min-h-[420px]">
            {loading ? (
              <div className="text-center text-slate-400 py-24">読み込み中...</div>
            ) : visibleProjects.length === 0 ? (
              <div className="bg-white border border-dashed border-sky-200 rounded-2xl text-center py-20">
                <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-400 grid place-items-center mx-auto mb-4 text-xl">＋</div>
                <p className="text-sm font-semibold text-slate-500">この種別の案件はまだありません</p>
                <Link
                  href={`/projects/new?type=${encodeURIComponent(selectedType)}`}
                  className="text-sky-500 hover:text-sky-600 text-xs mt-2 inline-block"
                >
                  最初の案件を作成
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {visibleProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    {...project}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
