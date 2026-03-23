"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProjectCard from "@/components/ProjectCard";

interface Project {
  id: string;
  name: string;
  type: string;
  updatedAt: string;
}

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    const res = await fetch("/api/projects");
    const data = await res.json();
    setProjects(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("この案件を削除しますか？")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ライティング自動化</h1>
            <p className="text-gray-500 text-sm mt-1">MEO・HP・LPのライティングを自動生成</p>
          </div>
          <Link
            href="/projects/new"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
          >
            + 新規案件作成
          </Link>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-20">読み込み中...</div>
        ) : projects.length === 0 ? (
          <div className="text-center text-gray-400 py-20">
            <p className="text-4xl mb-4">📝</p>
            <p>案件がありません</p>
            <Link
              href="/projects/new"
              className="text-blue-600 hover:underline text-sm mt-2 inline-block"
            >
              最初の案件を作成する
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                id={p.id}
                name={p.name}
                type={p.type}
                updatedAt={p.updatedAt}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
