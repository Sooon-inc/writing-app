"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const PROJECT_TYPES = [
  { value: "meo", label: "MEO", desc: "Googleビジネスプロフィール" },
  { value: "hp-strong", label: "HP ストロング", desc: "プレミアムHP 力強い文体" },
  { value: "hp-classic", label: "HP クラシック", desc: "プレミアムHP 品格ある文体" },
  { value: "hp-beauty", label: "HP ビューティー", desc: "プレミアムHP おしゃれな文体" },
  { value: "hp-recruit", label: "HP リクルート", desc: "プレミアムHP 採用向け文体" },
  { value: "lp", label: "LP", desc: "ランディングページ" },
  { value: "portal", label: "ポータルサイト", desc: "ポータルサイト用ライティング" },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState("meo");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("案件名を入力してください");
      return;
    }
    setLoading(true);
    setError("");

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), type }),
    });

    if (!res.ok) {
      setError("作成に失敗しました");
      setLoading(false);
      return;
    }

    const project = await res.json();
    router.push(`/projects/${project.id}`);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="mb-6">
          <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">
            ← 一覧に戻る
          </Link>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-6">新規案件作成</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              案件名
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 株式会社〇〇 MEO対策"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              商材タイプ
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PROJECT_TYPES.map((pt) => (
                <label
                  key={pt.value}
                  className={`flex flex-col p-3 rounded-lg border cursor-pointer transition-colors ${
                    type === pt.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={pt.value}
                    checked={type === pt.value}
                    onChange={() => setType(pt.value)}
                    className="sr-only"
                  />
                  <span className="font-medium text-sm text-gray-900">{pt.label}</span>
                  <span className="text-xs text-gray-500 mt-0.5">{pt.desc}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
          >
            {loading ? "作成中..." : "案件を作成"}
          </button>
        </form>
      </div>
    </main>
  );
}
