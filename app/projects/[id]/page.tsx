"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import WritingSection from "@/components/WritingSection";

const typeLabels: Record<string, string> = {
  meo: "MEO",
  "hp-strong": "HP ストロング",
  "hp-classic": "HP クラシック",
  "hp-beauty": "HP ビューティー",
  "hp-recruit": "HP リクルート",
  lp: "LP",
};

interface Project {
  id: string;
  name: string;
  type: string;
  hpUrl: string | null;
  hpContent: string | null;
  hearing: string | null;
  output: string | null;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [hpUrl, setHpUrl] = useState("");
  const [hearing, setHearing] = useState("");
  const [scraping, setScraping] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [scrapeError, setScrapeError] = useState("");
  const [genError, setGenError] = useState("");
  const [output, setOutput] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then((data: Project) => {
        setProject(data);
        setHpUrl(data.hpUrl ?? "");
        setHearing(data.hearing ?? "");
        if (data.output) {
          try {
            setOutput(JSON.parse(data.output));
          } catch {
            // ignore
          }
        }
      });
  }, [id]);

  const handleScrape = async () => {
    if (!hpUrl.trim()) return;
    setScraping(true);
    setScrapeError("");

    const res = await fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: hpUrl.trim() }),
    });

    const data = await res.json();
    setScraping(false);

    if (!res.ok) {
      setScrapeError(data.error ?? "スクレイピングに失敗しました");
      return;
    }

    // Save hpUrl and hpContent to DB
    await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hpUrl: hpUrl.trim(), hpContent: data.content }),
    });

    setProject((prev) =>
      prev ? { ...prev, hpUrl: hpUrl.trim(), hpContent: data.content } : prev
    );
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError("");

    // Save hearing first
    await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hearing }),
    });

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: project?.type,
        hpContent: project?.hpContent ?? "",
        hearing,
      }),
    });

    const data = await res.json();
    setGenerating(false);

    if (!res.ok) {
      setGenError(data.error ?? "生成に失敗しました");
      return;
    }

    const outputJson = JSON.stringify(data.output);
    await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ output: outputJson }),
    });

    setOutput(data.output);
  };

  if (!project) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-6">
          <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">
            ← 一覧に戻る
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
          <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            {typeLabels[project.type] ?? project.type}
          </span>
        </div>

        {/* Input area */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              HP URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={hpUrl}
                onChange={(e) => setHpUrl(e.target.value)}
                placeholder="https://example.com"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleScrape}
                disabled={scraping || !hpUrl.trim()}
                className="bg-gray-800 hover:bg-gray-700 disabled:bg-gray-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
              >
                {scraping ? "読み込み中..." : "読み込む"}
              </button>
            </div>
            {scrapeError && (
              <p className="text-red-500 text-xs mt-1">{scrapeError}</p>
            )}
            {project.hpContent && (
              <p className="text-green-600 text-xs mt-1">
                ✓ HP情報を取得済み ({project.hpContent.length.toLocaleString()}文字)
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              ヒアリング内容
            </label>
            <textarea
              value={hearing}
              onChange={(e) => setHearing(e.target.value)}
              placeholder="ヒアリングの文字起こしや、お客様からの情報をここに貼り付けてください..."
              rows={8}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
            />
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating || (!project.hpContent && !hearing)}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 rounded-xl transition-colors mb-8"
        >
          {generating ? "生成中..." : "ライティング生成"}
        </button>

        {genError && (
          <p className="text-red-500 text-sm mb-4">{genError}</p>
        )}

        {/* Output area */}
        {output && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-800">生成結果</h2>
            {Object.entries(output).map(([key, value]) => (
              <WritingSection key={key} title={key} value={value} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
