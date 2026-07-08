"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { HP_SITEMAPS } from "@/lib/hpSitemap";
import { isProjectType, PROJECT_TYPE_LABELS, type ProjectType } from "@/lib/projectTypes";
import AppSidebar from "@/components/AppSidebar";

const HP_TYPES = ["hp-classic", "hp-strong", "hp-beauty", "hp-recruit"];
const makeId = () => Math.random().toString(36).slice(2, 10);
type SitemapItem = { id: string; sheetName: string };

function NewProjectForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryType = searchParams.get("type");
  const type: ProjectType = isProjectType(queryType) ? queryType : "meo";
  const isHpType = HP_TYPES.includes(type);

  const pages = useMemo(() => HP_SITEMAPS[type] ?? [], [type]);
  const [name, setName] = useState("");
  const [hpUrl, setHpUrl] = useState("");
  const [gbpUrl, setGbpUrl] = useState("");
  const [hearing, setHearing] = useState("");
  const [industries, setIndustries] = useState<string[]>([""]);
  const [products, setProducts] = useState<string[]>([""]);
  const [sitemapItems, setSitemapItems] = useState<SitemapItem[]>([]);
  const [pageThemes, setPageThemes] = useState<Record<string, string>>({});
  const [instagram, setInstagram] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [line, setLine] = useState("");
  const [youtube, setYoutube] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fixedPages = pages.filter((page) => page.fixed && page.sheetName);
  const availableOptions = pages
    .filter((page) => page.sheetName && !page.fixed)
    .map((page) => ({ label: page.label, sheetName: page.sheetName! }));
  const activePages = [
    ...fixedPages.map((page) => ({
      label: page.label,
      sheetName: page.sheetName!,
      themeKey: page.sheetName!,
    })),
    ...sitemapItems
      .filter((item) => item.sheetName)
      .map((item) => {
        const found = pages.find((page) => page.sheetName === item.sheetName);
        return {
          label: found ? found.label : item.sheetName,
          sheetName: item.sheetName,
          themeKey: item.id,
        };
      }),
  ];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("会社名を入力してください");
      return;
    }

    setLoading(true);
    setError("");

    let sitemap: string | null = null;
    let themes: string | null = null;

    if (isHpType) {
      const savedThemes: Record<string, string> = {};
      fixedPages.forEach((page) => {
        savedThemes[page.sheetName!] = pageThemes[page.sheetName!] ?? "";
      });
      const selectedItems = sitemapItems
        .filter((item) => item.sheetName)
        .map((item) => {
          savedThemes[item.id] = pageThemes[item.id] ?? "";
          return { id: item.id, sheetName: item.sheetName };
        });
      sitemap = JSON.stringify(selectedItems);
      themes = JSON.stringify(savedThemes);
    } else if (type === "lp") {
      themes = JSON.stringify({ LP: pageThemes.LP ?? "" });
    } else if (type === "portal") {
      sitemap = JSON.stringify({
        sns: {
          instagram: instagram.trim(),
          x: xUrl.trim(),
          line: line.trim(),
          youtube: youtube.trim(),
        },
      });
    }

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        type,
        hpUrl: hpUrl.trim(),
        gbpUrl: gbpUrl.trim(),
        hearing: hearing.trim(),
        industries: JSON.stringify(industries.map((industry) => industry.trim()).filter(Boolean)),
        products: type === "meo"
          ? JSON.stringify(products.map((product) => product.trim()).filter(Boolean))
          : null,
        sitemap,
        hpPageThemes: themes,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? "作成に失敗しました");
      setLoading(false);
      return;
    }

    const project = await res.json();
    router.push(`/projects/${project.id}`);
  };

  const addProduct = () => {
    if (products.length < 10) setProducts((prev) => [...prev, ""]);
  };

  const addIndustry = () => setIndustries((prev) => [...prev, ""]);
  const addSitemapItem = () => setSitemapItems((prev) => [...prev, { id: makeId(), sheetName: "" }]);
  const updateSitemapItem = (index: number, sheetName: string) => {
    setSitemapItems((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, sheetName } : item));
  };
  const removeSitemapItem = (index: number) => {
    setSitemapItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };
  const updatePageTheme = (key: string, value: string) => {
    setPageThemes((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <main className="app-shell">
      <AppSidebar selectedType={type} />
      <div className="dashboard-main">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link href={`/projects/type/${type}`} className="text-gray-400 hover:text-gray-600 text-sm">
            ← {PROJECT_TYPE_LABELS[type]}の案件一覧に戻る
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">新規作成</h1>
          <p className="text-sm text-gray-500 mt-1">{PROJECT_TYPE_LABELS[type]}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="dashboard-card p-6 space-y-5">
            <h2 className="font-semibold text-gray-900">基本情報</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">会社名・店舗名</label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例：株式会社〇〇"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  業種
                  <span className="ml-1.5 text-xs text-gray-400 font-normal">（複数入力可能）</span>
                </label>
                <button type="button" onClick={addIndustry} className="text-xs text-sky-600 hover:text-sky-700 font-semibold">
                  ＋ 追加
                </button>
              </div>
              <div className="space-y-2">
                {industries.map((industry, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-5 text-right shrink-0">{index + 1}</span>
                    <input
                      type="text"
                      value={industry}
                      onChange={(event) =>
                        setIndustries((prev) => prev.map((item, itemIndex) => itemIndex === index ? event.target.value : item))
                      }
                      placeholder="例：住宅リフォーム、建築、外壁塗装"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                    />
                    {industries.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setIndustries((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                        className="w-8 h-8 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50"
                        aria-label={`業種${index + 1}を削除`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">HPのURL</label>
              <input
                type="url"
                value={hpUrl}
                onChange={(event) => setHpUrl(event.target.value)}
                placeholder="https://example.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">GBPのURL</label>
              <input
                type="url"
                value={gbpUrl}
                onChange={(event) => setGbpUrl(event.target.value)}
                placeholder="https://maps.app.goo.gl/..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">打ち合わせ内容</label>
              <textarea
                value={hearing}
                onChange={(event) => setHearing(event.target.value)}
                placeholder="文字起こしやヒアリング内容を貼り付けてください"
                rows={8}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
            </div>
          </section>

          {isHpType && (
            <section className="dashboard-card p-6 space-y-4">
              <div>
                <h2 className="font-semibold text-gray-900">各ページの入力</h2>
                <p className="text-xs text-gray-400 mt-1">作成するページを追加し、テーマやキーワードを入力してください</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-800">ページ構成</h3>
                    <button
                      type="button"
                      onClick={addSitemapItem}
                      disabled={availableOptions.length === 0}
                      className="text-xs text-sky-600 hover:text-sky-700 disabled:text-gray-300 font-semibold"
                    >
                      ＋ ページを追加
                    </button>
                  </div>
                  <div className="space-y-2">
                    {fixedPages.map((page) => (
                      <div key={page.sheetName} className="flex items-center gap-2">
                        <div className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500">
                          {page.label}
                        </div>
                        <span className="text-xs text-gray-400 w-8 text-center shrink-0">固定</span>
                      </div>
                    ))}
                    {sitemapItems.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <select
                          value={item.sheetName}
                          onChange={(event) => updateSitemapItem(index, event.target.value)}
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-400"
                        >
                          <option value="">（ページを選択）</option>
                          {availableOptions.map((option) => (
                            <option key={option.sheetName} value={option.sheetName}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeSitemapItem(index)}
                          className="w-8 h-8 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50"
                          aria-label={`追加ページ${index + 1}を削除`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-gray-200 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">テーマ・キーワード</h3>
                  <div className="space-y-2">
                    {activePages.map(({ label, themeKey }) => (
                      <div key={themeKey}>
                        <label className="block text-xs text-gray-500 mb-1">{label}</label>
                        <input
                          type="text"
                          value={pageThemes[themeKey] ?? ""}
                          onChange={(event) => updatePageTheme(themeKey, event.target.value)}
                          placeholder="例：外壁塗装、防水工事、施工実績"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {type === "lp" && (
            <section className="dashboard-card p-6">
              <h2 className="font-semibold text-gray-900 mb-4">各ページの入力</h2>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">LPのテーマ・キーワード</label>
              <input
                type="text"
                value={pageThemes.LP ?? ""}
                onChange={(event) => setPageThemes({ LP: event.target.value })}
                placeholder="例：外壁塗装、地域密着、無料診断"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </section>
          )}

          {type === "meo" && (
            <section className="dashboard-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">商品・サービス名</h2>
                <button type="button" onClick={addProduct} disabled={products.length >= 10} className="text-sm text-blue-600 disabled:text-gray-300">
                  ＋ 追加
                </button>
              </div>
              <div className="space-y-2">
                {products.map((product, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-5 text-right">{index + 1}</span>
                    <input
                      type="text"
                      value={product}
                      onChange={(event) =>
                        setProducts((prev) => prev.map((item, itemIndex) => itemIndex === index ? event.target.value : item))
                      }
                      placeholder="例：外壁塗装"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {products.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setProducts((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                        className="text-gray-300 hover:text-red-500 text-lg"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {type === "portal" && (
            <section className="dashboard-card p-6 space-y-3">
              <h2 className="font-semibold text-gray-900">SNS URL</h2>
              {[
                ["Instagram", instagram, setInstagram, "https://www.instagram.com/..."],
                ["X", xUrl, setXUrl, "https://x.com/..."],
                ["LINE公式", line, setLine, "https://lin.ee/..."],
                ["YouTube", youtube, setYoutube, "https://www.youtube.com/..."],
              ].map(([label, value, setter, placeholder]) => (
                <div key={label as string}>
                  <label className="block text-sm text-gray-600 mb-1">{label as string}</label>
                  <input
                    type="url"
                    value={value as string}
                    onChange={(event) => (setter as (value: string) => void)(event.target.value)}
                    placeholder={placeholder as string}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </section>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full soft-button disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {loading ? "作成中..." : "案件を作成して入力画面へ"}
          </button>
        </form>
      </div>
      </div>
    </main>
  );
}

export default function NewProjectPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 p-10 text-center text-gray-400">読み込み中...</div>}>
      <NewProjectForm />
    </Suspense>
  );
}
