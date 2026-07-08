"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ProjectCard from "@/components/ProjectCard";
import AppSidebar from "@/components/AppSidebar";
import { isProjectType, PROJECT_TYPE_LABELS } from "@/lib/projectTypes";

interface Project {
  id: string;
  name: string;
  type: string;
  updatedAt: string;
}

export default function ProjectTypePage() {
  const { type } = useParams<{ type: string }>();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isProjectType(type)) {
      setLoading(false);
      return;
    }
    fetch(`/api/projects?type=${encodeURIComponent(type)}`)
      .then((res) => res.json())
      .then((data) => setProjects(data))
      .finally(() => setLoading(false));
  }, [type]);

  const handleDelete = async (id: string) => {
    if (!confirm("この案件を削除しますか？")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setProjects((prev) => prev.filter((project) => project.id !== id));
  };

  if (!isProjectType(type)) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-10">
          <Link href="/" className="text-blue-600 hover:underline">種類一覧に戻る</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <AppSidebar selectedType={type} />
      <div className="dashboard-main">
        <div className="mb-6">
          <Link href="/" className="text-sky-500 hover:text-sky-600 text-sm">
            ← ダッシュボードに戻る
          </Link>
        </div>

        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-700">{PROJECT_TYPE_LABELS[type]}</h1>
            <p className="text-slate-400 text-sm mt-1">案件一覧</p>
          </div>
          <Link
            href={`/projects/new?type=${encodeURIComponent(type)}`}
            className="soft-button font-medium px-4 py-2.5 text-sm whitespace-nowrap"
          >
            ＋ 新規作成
          </Link>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-20">読み込み中...</div>
        ) : projects.length === 0 ? (
          <div className="dashboard-card text-center text-slate-400 py-16">
            <p>この種類の案件はまだありません</p>
            <Link
              href={`/projects/new?type=${encodeURIComponent(type)}`}
              className="text-blue-600 hover:underline text-sm mt-2 inline-block"
            >
              最初の案件を作成する
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                id={project.id}
                name={project.name}
                type={project.type}
                updatedAt={project.updatedAt}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
