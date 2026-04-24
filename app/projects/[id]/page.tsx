"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { HP_SITEMAPS } from "@/lib/hpSitemap";
import type { SitemapPage } from "@/lib/hpSitemap";
import { PORTAL_SECTION_GROUPS } from "@/lib/templates/portal";
import ChatBot, { type ChatOutput, type UpdatePayload } from "@/components/ChatBot";
import HpPageCard from "@/components/HpPageCard";
import MeoOutputDisplay from "@/components/MeoOutputDisplay";
import OutputTable, { type SelectedTarget } from "@/components/OutputTable";

const typeLabels: Record<string, string> = {
  meo: "MEO",
  "hp-strong": "HP ストロング",
  "hp-classic": "HP クラシック",
  "hp-beauty": "HP ビューティー",
  "hp-recruit": "HP リクルート",
  lp: "LP",
  portal: "ポータルサイト",
};

const HP_TYPES = ["hp-classic", "hp-strong", "hp-beauty", "hp-recruit"];

// サイトマップの任意ページエントリー（固有IDで独立管理）
interface SitemapItem {
  id: string;
  sheetName: string;
}
const genId = () => Math.random().toString(36).slice(2, 10);

interface Project {
  id: string;
  name: string;
  type: string;
  hpUrl: string | null;
  hpContent: string | null;
  gbpUrl: string | null;
  hearing: string | null;
  products: string | null;
  output: string | null;
  sitemap: string | null;
  hpPageOutputs: string | null;
  hpPageThemes: string | null;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [hpUrl, setHpUrl] = useState("");
  const [hearing, setHearing] = useState("");
  const [products, setProducts] = useState<string[]>([""]);
  const [scraping, setScraping] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [scrapeError, setScrapeError] = useState("");
  const [genError, setGenError] = useState("");
  const [gbpUrl, setGbpUrl] = useState("");
  const [gbpContent, setGbpContent] = useState("");
  const [scrapingGbp, setScrapingGbp] = useState(false);
  const [gbpScrapeError, setGbpScrapeError] = useState("");

  // ポータル専用
  const [portalGbpUrl, setPortalGbpUrl] = useState("");
  const [portalInstagram, setPortalInstagram] = useState("");
  const [portalTiktok, setPortalTiktok] = useState("");
  const [portalYoutube, setPortalYoutube] = useState("");
  const [portalGenerating, setPortalGenerating] = useState(false);
  const [portalGenError, setPortalGenError] = useState("");
  const [openingPortalSheet, setOpeningPortalSheet] = useState(false);
  const [output, setOutput] = useState<Record<string, unknown> | null>(null);

  // HP sitemap state
  const [sitemapPages, setSitemapPages] = useState<SitemapPage[]>([]);
  const [sitemapItems, setSitemapItems] = useState<SitemapItem[]>([]);
  // pageThemes: id（任意ページ）またはsheetName（固定ページ）→ theme/keyword text
  const [pageThemes, setPageThemes] = useState<Record<string, string>>({});
  const [hpPageOutputs, setHpPageOutputs] = useState<Record<string, Record<number, string>> | null>(null);
  const [generatingHp, setGeneratingHp] = useState(false);
  const [hpGenError, setHpGenError] = useState("");
  const [generatingSheet, setGeneratingSheet] = useState("");

  const isHpType = project ? HP_TYPES.includes(project.type) : false;
  const isLpType = project?.type === "lp";
  const isPortalType = project?.type === "portal";

  // Fixed pages (always included)
  const fixedPages = sitemapPages.filter((p) => p.fixed);

  // Available options for user-added dropdowns
  const availableOptions = sitemapPages
    .filter((p) => p.sheetName && !p.fixed)
    .map((p) => ({ label: p.label, sheetName: p.sheetName! }));

  // All active pages for the theme panel (fixed + user-selected non-empty)
  // 固定ページはsheetNameをthemeKey、任意ページはitem.idをthemeKeyとして独立管理
  const activePages: { label: string; sheetName: string; themeKey: string }[] = [
    ...fixedPages.map((p) => ({ label: p.label, sheetName: p.sheetName!, themeKey: p.sheetName! })),
    ...sitemapItems
      .filter((item) => item.sheetName)
      .map((item) => {
        const found = sitemapPages.find((p) => p.sheetName === item.sheetName);
        return {
          label: found ? found.label : item.sheetName,
          sheetName: item.sheetName,
          themeKey: item.id,
        };
      }),
  ];

  // Strip fixed sheets from sitemapItems once sitemapPages loads
  useEffect(() => {
    if (sitemapPages.length === 0) return;
    const fixedSheetNames = new Set(
      sitemapPages.filter((p) => p.fixed).map((p) => p.sheetName!)
    );
    setSitemapItems((prev) => prev.filter((item) => !fixedSheetNames.has(item.sheetName)));
  }, [sitemapPages]);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then((data: Project) => {
        setProject(data);
        setHpUrl(data.hpUrl ?? "");
        setGbpUrl(data.gbpUrl ?? "");
        if (data.type === "portal") {
          setPortalGbpUrl(data.gbpUrl ?? "");
          if (data.sitemap) {
            try {
              const s = JSON.parse(data.sitemap) as { sns?: { instagram?: string; tiktok?: string; youtube?: string } };
              setPortalInstagram(s.sns?.instagram ?? "");
              setPortalTiktok(s.sns?.tiktok ?? "");
              setPortalYoutube(s.sns?.youtube ?? "");
            } catch { /* ignore */ }
          }
        }
        setHearing(data.hearing ?? "");
        if (data.products) {
          try {
            const parsed = JSON.parse(data.products);
            setProducts(parsed.length > 0 ? parsed : [""]);
          } catch {
            setProducts([""]);
          }
        }
        if (data.output) {
          try { setOutput(JSON.parse(data.output)); } catch { /* ignore */ }
        }
        if (data.sitemap) {
          try {
            const parsed = JSON.parse(data.sitemap);
            if (Array.isArray(parsed) && parsed.length > 0) {
              if (typeof parsed[0] === "string") {
                // 旧形式 string[] → SitemapItem[] に移行
                setSitemapItems((parsed as string[]).map((s) => ({ id: genId(), sheetName: s })));
              } else {
                setSitemapItems(parsed as SitemapItem[]);
              }
            }
          } catch { /* ignore */ }
        }
        if (data.hpPageOutputs) {
          try { setHpPageOutputs(JSON.parse(data.hpPageOutputs)); } catch { /* ignore */ }
        }
        if (data.hpPageThemes) {
          try {
            const themes = JSON.parse(data.hpPageThemes) as Record<string, string>;
            setPageThemes(themes);
            if (themes["LP"]) setLpTheme(themes["LP"]);
          } catch { /* ignore */ }
        }
        if (data.hpPageOutputs && data.type === "lp") {
          try {
            const outputs = JSON.parse(data.hpPageOutputs) as Record<string, Record<number, string>>;
            if (outputs["LP"]) setLpOutput(outputs["LP"]);
          } catch { /* ignore */ }
        }
        if (HP_TYPES.includes(data.type)) {
          fetch(`/api/hp-sitemap?type=${data.type}`)
            .then((r) => r.json())
            .then((res: { pages: SitemapPage[] }) => setSitemapPages(res.pages));
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
    if (!res.ok) { setScrapeError(data.error ?? "スクレイピングに失敗しました"); return; }
    await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hpUrl: hpUrl.trim(), hpContent: data.content }),
    });
    setProject((prev) => prev ? { ...prev, hpUrl: hpUrl.trim(), hpContent: data.content } : prev);
  };

  const handleScrapeGbp = async () => {
    if (!gbpUrl.trim()) return;
    setScrapingGbp(true);
    setGbpScrapeError("");
    const res = await fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: gbpUrl.trim() }),
    });
    const data = await res.json();
    setScrapingGbp(false);
    if (!res.ok) { setGbpScrapeError(data.error ?? "GBP情報の取得に失敗しました"); return; }
    setGbpContent(data.content);
    await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gbpUrl: gbpUrl.trim() }),
    });
    setProject((prev) => prev ? { ...prev, gbpUrl: gbpUrl.trim() } : prev);
  };

  const handleGeneratePortal = async () => {
    setPortalGenerating(true);
    setPortalGenError("");
    const res = await fetch("/api/generate-portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: id,
        hpUrl: hpUrl.trim(),
        gbpUrl: portalGbpUrl.trim(),
        sns: {
          instagram: portalInstagram.trim(),
          tiktok: portalTiktok.trim(),
          youtube: portalYoutube.trim(),
        },
        hearing,
      }),
    });
    const data = await res.json();
    setPortalGenerating(false);
    if (!res.ok) { setPortalGenError(data.error ?? "生成に失敗しました"); return; }
    setOutput(data.output);
    setProject((prev) => prev ? { ...prev, output: JSON.stringify(data.output) } : prev);
  };

  const handleDownloadPortal = async () => {
    const res = await fetch("/api/export/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ output, projectName: project?.name }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.name ?? "ポータル"}_原稿.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenPortalSheet = async () => {
    setOpeningPortalSheet(true);
    setSheetError("");
    setSheetUrl(null);
    const check = await fetch("/api/auth/google/check");
    if (!check.ok) {
      window.location.href = `/api/auth/google?projectId=${id}&sheetType=portal`;
      return;
    }
    const res = await fetch("/api/export/portal/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ output, projectName: project?.name }),
    });
    setOpeningPortalSheet(false);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      setSheetError((errData as { error?: string }).error ?? "スプレッドシートの作成に失敗しました");
      return;
    }
    const { url } = await res.json();
    setSheetUrl(url);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError("");
    const filledProducts = products.filter((p) => p.trim());
    await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hearing, products: JSON.stringify(filledProducts) }),
    });
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: project?.type, hpContent: project?.hpContent ?? "", hearing, products: filledProducts, gbpContent }),
    });
    const data = await res.json();
    setGenerating(false);
    if (!res.ok) { setGenError(data.error ?? "生成に失敗しました"); return; }
    const outputJson = JSON.stringify(data.output);
    await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ output: outputJson }),
    });
    setOutput(data.output);
  };

  const handleGenerateHpPages = async () => {
    if (!project) return;
    const sitemapConfig = HP_SITEMAPS[project.type] ?? [];

    // 固定ページ: instanceKey = sheetName（重複なし）
    const fixedItems = sitemapConfig
      .filter((p) => p.fixed && p.sheetName)
      .map((p) => ({
        sheetName: p.sheetName!,
        instanceKey: p.sheetName!,
        theme: pageThemes[p.sheetName!] ?? "",
        label: p.label,
      }));

    // 任意ページ: instanceKey = item.id（同じシートを複数追加しても独立して扱う）
    const optionalItems = sitemapItems
      .filter((item) => item.sheetName)
      .map((item) => {
        const found = sitemapConfig.find((p) => p.sheetName === item.sheetName);
        return {
          sheetName: item.sheetName,
          instanceKey: item.id,
          theme: pageThemes[item.id] ?? "",
          label: found ? found.label : item.sheetName,
        };
      });

    const allItems = [...fixedItems, ...optionalItems];
    if (allItems.length === 0) return;

    setGeneratingHp(true);
    setHpGenError("");

    // Save themes before generating
    await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hearing, hpUrl, hpPageThemes: JSON.stringify(pageThemes) }),
    });

    const allOutputs: Record<string, Record<number, string>> = {};
    for (const item of allItems) {
      setGeneratingSheet(item.label);
      const res = await fetch("/api/generate-hp-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: id,
          sheetName: item.sheetName,
          instanceKey: item.instanceKey,
          theme: item.theme,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setHpGenError(data.error ?? "生成に失敗しました");
        setGeneratingHp(false);
        setGeneratingSheet("");
        return;
      }
      Object.assign(allOutputs, data.hpPageOutputs);
    }

    await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sitemap: JSON.stringify(sitemapItems), hpPageOutputs: JSON.stringify(allOutputs) }),
    });

    setHpPageOutputs(allOutputs);
    setGeneratingHp(false);
    setGeneratingSheet("");
  };

  const handleDownloadHp = async () => {
    const res = await fetch("/api/export/hp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: id }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.name ?? "HP"}_HPヒアリングシート.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleChatApply = async (updates: UpdatePayload) => {
    if (updates.kind === "output") {
      const next = { ...(output ?? {}), ...updates.diff };
      setOutput(next);
      await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ output: JSON.stringify(next) }),
      });
    } else if (updates.kind === "hp") {
      const next = { ...(hpPageOutputs ?? {}) };
      for (const [key, rows] of Object.entries(updates.diff)) {
        next[key] = {
          ...(next[key] ?? {}),
          ...Object.fromEntries(
            Object.entries(rows).map(([r, v]) => [parseInt(r), v])
          ),
        };
      }
      setHpPageOutputs(next);
      await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hpPageOutputs: JSON.stringify(next) }),
      });
    } else if (updates.kind === "lp") {
      const next = {
        ...(lpOutput ?? {}),
        ...Object.fromEntries(
          Object.entries(updates.diff).map(([r, v]) => [parseInt(r), v])
        ),
      };
      setLpOutput(next);
      const existingHpOut = (() => {
        try { return JSON.parse(project?.hpPageOutputs ?? "{}") as Record<string, unknown>; }
        catch { return {}; }
      })();
      await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hpPageOutputs: JSON.stringify({ ...existingHpOut, LP: next }) }),
      });
    }
  };

  // LP state
  // Sheets export loading states
  const [openingHpSheet, setOpeningHpSheet] = useState(false);
  const [openingLpSheet, setOpeningLpSheet] = useState(false);
  const [openingMeoSheet, setOpeningMeoSheet] = useState(false);
  const [pendingOpenSheet, setPendingOpenSheet] = useState<string | null>(null);
  const [autoTriggerLoading, setAutoTriggerLoading] = useState(false);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState("");

  // OAuth後にURLパラメータ openSheet があれば自動実行
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const openSheet = params.get("openSheet");
    if (openSheet) {
      setPendingOpenSheet(openSheet);
      const url = new URL(window.location.href);
      url.searchParams.delete("openSheet");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const handleOpenHpSheet = async () => {
    setOpeningHpSheet(true);
    setSheetError("");
    setSheetUrl(null);
    const check = await fetch("/api/auth/google/check");
    if (!check.ok) {
      window.location.href = `/api/auth/google?projectId=${id}&sheetType=hp`;
      return;
    }
    const res = await fetch("/api/export/hp/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: id }),
    });
    setOpeningHpSheet(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSheetError((data as { error?: string }).error ?? "スプレッドシートの作成に失敗しました");
      return;
    }
    const { url } = await res.json();
    setSheetUrl(url);
  };

  const handleOpenLpSheet = async () => {
    setOpeningLpSheet(true);
    setSheetError("");
    setSheetUrl(null);
    const check = await fetch("/api/auth/google/check");
    if (!check.ok) {
      window.location.href = `/api/auth/google?projectId=${id}&sheetType=lp`;
      return;
    }
    const res = await fetch("/api/export/lp/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: id }),
    });
    setOpeningLpSheet(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSheetError((data as { error?: string }).error ?? "スプレッドシートの作成に失敗しました");
      return;
    }
    const { url } = await res.json();
    setSheetUrl(url);
  };

  const handleOpenMeoSheet = async () => {
    setOpeningMeoSheet(true);
    setSheetError("");
    setSheetUrl(null);
    const check = await fetch("/api/auth/google/check");
    if (!check.ok) {
      window.location.href = `/api/auth/google?projectId=${id}&sheetType=meo`;
      return;
    }
    const res = await fetch("/api/export/meo/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ output, projectName: project?.name, hpUrl }),
    });
    setOpeningMeoSheet(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSheetError((data as { error?: string }).error ?? "スプレッドシートの作成に失敗しました");
      return;
    }
    const { url } = await res.json();
    setSheetUrl(url);
  };

  // LP state
  const [lpTheme, setLpTheme] = useState("");
  const [lpOutput, setLpOutput] = useState<Record<number, string> | null>(null);
  const [generatingLp, setGeneratingLp] = useState(false);
  const [lpGenError, setLpGenError] = useState("");
  const [lpFieldDefs, setLpFieldDefs] = useState<{ rn: number; section: string; label: string; condition?: string }[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(null);

  useEffect(() => {
    if (isLpType && lpOutput && lpFieldDefs.length === 0) {
      fetch("/api/lp-fields")
        .then((r) => r.json())
        .then((data: { fields: { rn: number; section: string; label: string }[] }) => setLpFieldDefs(data.fields))
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lpOutput, isLpType]);

  const handleGenerateLp = async () => {
    setGeneratingLp(true);
    setLpGenError("");
    await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hearing, hpUrl }),
    });
    const res = await fetch("/api/generate-lp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: id, theme: lpTheme }),
    });
    const data = await res.json();
    setGeneratingLp(false);
    if (!res.ok) { setLpGenError(data.error ?? "生成に失敗しました"); return; }
    setLpOutput(data.lpOutput);
  };

  const handleDownloadLp = async () => {
    const res = await fetch("/api/export/lp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: id }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.name ?? "LP"}_LPヒアリングシート.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // pendingOpenSheet: OAuth後にプロジェクトデータが揃い次第自動実行
  // window.open はユーザー操作外でブロックされるため、APIを直接呼びURLをステートに保存する
  useEffect(() => {
    if (!pendingOpenSheet || !project) return;

    const type = pendingOpenSheet;
    setPendingOpenSheet(null);
    setSheetError("");
    setAutoTriggerLoading(true);

    const run = async () => {
      try {
        let res: Response;
        if (type === "hp") {
          res = await fetch("/api/export/hp/sheets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId: id }),
          });
        } else if (type === "lp") {
          res = await fetch("/api/export/lp/sheets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId: id }),
          });
        } else if (type === "portal") {
          res = await fetch("/api/export/portal/sheets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ output, projectName: project.name }),
          });
        } else {
          res = await fetch("/api/export/meo/sheets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ output, projectName: project.name, hpUrl }),
          });
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setSheetError((data as { error?: string }).error ?? "スプレッドシートの作成に失敗しました");
          return;
        }
        const { url } = await res.json();
        setSheetUrl(url);
      } catch (e) {
        setSheetError(String(e));
      } finally {
        setAutoTriggerLoading(false);
      }
    };
    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOpenSheet, project]);

  const addSitemapItem = () => setSitemapItems((prev) => [...prev, { id: genId(), sheetName: "" }]);
  const updateSitemapItem = (index: number, value: string) =>
    setSitemapItems((prev) => prev.map((item, i) => (i === index ? { ...item, sheetName: value } : item)));
  const removeSitemapItem = (index: number) =>
    setSitemapItems((prev) => prev.filter((_, i) => i !== index));

  const updateTheme = (sheetName: string, value: string) =>
    setPageThemes((prev) => ({ ...prev, [sheetName]: value }));

  const addProduct = () => { if (products.length < 10) setProducts((prev) => [...prev, ""]); };
  const updateProduct = (index: number, value: string) =>
    setProducts((prev) => prev.map((p, i) => (i === index ? value : p)));
  const removeProduct = (index: number) =>
    setProducts((prev) => { const next = prev.filter((_, i) => i !== index); return next.length > 0 ? next : [""]; });

  if (!project) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">読み込み中...</p>
      </main>
    );
  }

  const sitemapConfig = project ? (HP_SITEMAPS[project.type] ?? []) : [];

  const chatOutput: ChatOutput | null = (() => {
    if (!project) return null;
    if (isLpType) return lpOutput ? { type: "lp", data: lpOutput } : null;
    if (isHpType) return hpPageOutputs ? { type: "hp", data: hpPageOutputs, themes: pageThemes } : null;
    if (isPortalType) return output ? { type: "portal", data: output } : null;
    return output ? { type: "meo", data: output } : null;
  })();
  // 生成対象ラベル一覧（固定ページ + 任意ページ、重複あり）
  const pagesToGenerateLabels = [
    ...sitemapConfig.filter((p) => p.fixed && p.sheetName).map((p) => p.label),
    ...sitemapItems
      .filter((item) => item.sheetName)
      .map((item) => {
        const found = sitemapConfig.find((p) => p.sheetName === item.sheetName);
        return found ? found.label : item.sheetName;
      }),
  ];
  // instanceKey → 表示ラベルのマッピング（output表示用）
  const outputKeyToLabel: Record<string, string> = {};
  for (const p of sitemapConfig) {
    if (p.fixed && p.sheetName) outputKeyToLabel[p.sheetName] = p.label;
  }
  for (const item of sitemapItems) {
    if (item.sheetName) {
      const found = sitemapConfig.find((p) => p.sheetName === item.sheetName);
      outputKeyToLabel[item.id] = found ? found.label : item.sheetName;
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-10">
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

        {autoTriggerLoading && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-blue-700 font-medium">スプレッドシートを作成中...</p>
          </div>
        )}
        {sheetUrl && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center justify-between">
            <p className="text-sm text-green-700 font-medium">スプレッドシートが作成されました</p>
            <div className="flex items-center gap-3">
              <a
                href={sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                スプレッドシートを開く →
              </a>
              <button onClick={() => setSheetUrl(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            </div>
          </div>
        )}
        {sheetError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center justify-between">
            <p className="text-sm text-red-600">{sheetError}</p>
            <button onClick={() => setSheetError("")} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>
        )}

        {/* Input area */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 mb-6">
          {isPortalType ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ホームページ URL</label>
                <input
                  type="url"
                  value={hpUrl}
                  onChange={(e) => setHpUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  GBP URL
                  <span className="ml-1.5 text-xs text-gray-400 font-normal">（Googleビジネスプロフィール）</span>
                </label>
                <input
                  type="url"
                  value={portalGbpUrl}
                  onChange={(e) => setPortalGbpUrl(e.target.value)}
                  placeholder="https://business.google.com/..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">SNS URL（任意）</label>
                <div className="space-y-2">
                  <input
                    type="url"
                    value={portalInstagram}
                    onChange={(e) => setPortalInstagram(e.target.value)}
                    placeholder="Instagram: https://www.instagram.com/..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="url"
                    value={portalTiktok}
                    onChange={(e) => setPortalTiktok(e.target.value)}
                    placeholder="TikTok: https://www.tiktok.com/..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="url"
                    value={portalYoutube}
                    onChange={(e) => setPortalYoutube(e.target.value)}
                    placeholder="YouTube: https://www.youtube.com/..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">HP URL</label>
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
              {scrapeError && <p className="text-red-500 text-xs mt-1">{scrapeError}</p>}
              {project.hpContent && (
                <p className="text-green-600 text-xs mt-1">
                  ✓ HP情報を取得済み ({project.hpContent.length.toLocaleString()}文字)
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ヒアリング内容</label>
            <textarea
              value={hearing}
              onChange={(e) => setHearing(e.target.value)}
              placeholder="ヒアリングの文字起こしや、お客様からの情報をここに貼り付けてください..."
              rows={8}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
            />
          </div>

          {project.type === "meo" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                GBP URL
                <span className="ml-1.5 text-xs text-gray-400 font-normal">（GoogleビジネスプロフィールのURL）</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={gbpUrl}
                  onChange={(e) => setGbpUrl(e.target.value)}
                  placeholder="https://business.google.com/... または maps.google.com/..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleScrapeGbp}
                  disabled={scrapingGbp || !gbpUrl.trim()}
                  className="bg-gray-800 hover:bg-gray-700 disabled:bg-gray-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                >
                  {scrapingGbp ? "読み込み中..." : "読み込む"}
                </button>
              </div>
              {gbpScrapeError && <p className="text-red-500 text-xs mt-1">{gbpScrapeError}</p>}
              {gbpContent && (
                <p className="text-green-600 text-xs mt-1">✓ GBP情報を取得済み ({gbpContent.length.toLocaleString()}文字)</p>
              )}
            </div>
          )}

          {project.type === "meo" && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  商品・サービス名
                  <span className="ml-1.5 text-xs text-gray-400 font-normal">（{products.length}/10）</span>
                </label>
                <button
                  type="button"
                  onClick={addProduct}
                  disabled={products.length >= 10}
                  className="text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-300 font-medium"
                >
                  ＋ 追加
                </button>
              </div>
              <div className="space-y-2">
                {products.map((product, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <span className="text-xs text-gray-400 w-5 text-right shrink-0">{index + 1}</span>
                    <input
                      type="text"
                      value={product}
                      onChange={(e) => updateProduct(index, e.target.value)}
                      placeholder="例: 外壁塗装、屋根リフォーム..."
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {products.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeProduct(index)}
                        className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* LP type */}
        {isLpType && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {/* Left: LP fixed page */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-800 mb-4 text-sm">ページ構成</h2>
                <div className="flex items-center gap-2">
                  <div className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500">
                    LP（ランディングページ）
                  </div>
                  <span className="text-xs text-gray-400 w-6 text-center shrink-0">固定</span>
                </div>
              </div>
              {/* Right: LP theme */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-800 mb-4 text-sm">テーマ・キーワード</h2>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">LP</label>
                  <input
                    type="text"
                    value={lpTheme}
                    onChange={(e) => setLpTheme(e.target.value)}
                    placeholder="例: 外壁塗装、リフォーム、地域密着"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <button
                onClick={handleGenerateLp}
                disabled={generatingLp}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                {generatingLp ? "生成中..." : "LP生成"}
              </button>
              {lpGenError && <p className="text-red-500 text-xs mt-2">{lpGenError}</p>}
            </div>

            {lpOutput && Object.keys(lpOutput).length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-800">生成結果</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDownloadLp}
                      className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      Excelダウンロード
                    </button>
                    <button
                      onClick={handleOpenLpSheet}
                      disabled={openingLpSheet}
                      className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      {openingLpSheet ? "処理中..." : "スプレッドシートで開く"}
                    </button>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {lpFieldDefs.length > 0 ? (
                    <OutputTable
                      fields={lpFieldDefs}
                      output={Object.fromEntries(Object.entries(lpOutput).map(([k, v]) => [k, String(v)]))}
                      selectedRn={selectedTarget?.instanceKey === "LP" ? selectedTarget.rn : undefined}
                      onSelectRow={(rn, section, label, value) =>
                        setSelectedTarget({
                          instanceKey: "LP",
                          pageLabel: "LP",
                          rn,
                          section,
                          label,
                          currentValue: value,
                          displayText: `LP › [${section}] ${label}`,
                        })
                      }
                    />
                  ) : (
                    <div className="p-5 space-y-1.5">
                      {Object.entries(lpOutput)
                        .sort(([a], [b]) => parseInt(a) - parseInt(b))
                        .map(([rowNum, value]) =>
                          value ? (
                            <div key={rowNum} className="flex gap-3 text-sm">
                              <span className="text-gray-300 w-8 shrink-0 text-right">R{rowNum}</span>
                              <span className="text-gray-700">{value}</span>
                            </div>
                          ) : null
                        )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* HP type: sitemap + themes + generate */}
        {isHpType ? (
          <div className="space-y-6">
            {/* 2-column: left = sitemap, right = themes */}
            <div className="grid grid-cols-2 gap-4">
              {/* Left: Sitemap */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-800 mb-4 text-sm">サイトマップ設定</h2>
                <div className="space-y-2">
                  {fixedPages.map((page) => (
                    <div key={page.no} className="flex items-center gap-2">
                      <div className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500">
                        {page.label}
                      </div>
                      <span className="text-xs text-gray-400 w-6 text-center shrink-0">固定</span>
                    </div>
                  ))}
                  {sitemapItems.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <select
                        value={item.sheetName}
                        onChange={(e) => updateSitemapItem(index, e.target.value)}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">（シートを選択）</option>
                        {availableOptions.map((o) => (
                          <option key={o.sheetName} value={o.sheetName}>{o.label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeSitemapItem(index)}
                        className="text-gray-300 hover:text-red-400 transition-colors text-xl leading-none w-6 text-center shrink-0"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={addSitemapItem}
                  disabled={availableOptions.length === 0}
                  className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-300 font-medium"
                >
                  <span className="text-base leading-none">＋</span>
                  ページを追加
                </button>
              </div>

              {/* Right: Themes */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-800 mb-4 text-sm">テーマ・キーワード</h2>
                {activePages.length === 0 ? (
                  <p className="text-xs text-gray-400">左でページを選択すると表示されます</p>
                ) : (
                  <div className="space-y-2">
                    {activePages.map(({ label, themeKey }) => (
                      <div key={themeKey}>
                        <label className="block text-xs text-gray-500 mb-1">{label}</label>
                        <input
                          type="text"
                          value={pageThemes[themeKey] ?? ""}
                          onChange={(e) => updateTheme(themeKey, e.target.value)}
                          placeholder="例: 外壁塗装、防水工事、施工実績"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Generate button */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-400 mb-3">
                生成対象: {pagesToGenerateLabels.length}ページ
                {pagesToGenerateLabels.length > 0 && (
                  <span className="ml-1 text-gray-300">({pagesToGenerateLabels.join(" / ")})</span>
                )}
              </p>
              <button
                onClick={handleGenerateHpPages}
                disabled={generatingHp}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                {generatingHp
                  ? `生成中... ${generatingSheet ? `(${generatingSheet})` : ""}`
                  : "全ページ生成"}
              </button>
              {hpGenError && <p className="text-red-500 text-xs mt-2">{hpGenError}</p>}
            </div>

            {/* HP output */}
            {hpPageOutputs && Object.keys(hpPageOutputs).length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-800">生成結果</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDownloadHp}
                      className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      Excelダウンロード
                    </button>
                    <button
                      onClick={handleOpenHpSheet}
                      disabled={openingHpSheet}
                      className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      {openingHpSheet ? "処理中..." : "スプレッドシートで開く"}
                    </button>
                  </div>
                </div>
                {Object.entries(hpPageOutputs).map(([key, rows]) => {
                  const sheetName = (() => {
                    // Fixed pages: key === sheetName
                    const fixedMatch = sitemapConfig.find((p) => p.fixed && p.sheetName === key);
                    if (fixedMatch) return key;
                    // Optional pages: look up from sitemapItems
                    const item = sitemapItems.find((it) => it.id === key);
                    return item?.sheetName ?? key;
                  })();
                  return (
                    <HpPageCard
                      key={key}
                      instanceKey={key}
                      label={outputKeyToLabel[key] ?? key}
                      theme={pageThemes[key] ?? ""}
                      rows={rows}
                      projectType={project.type}
                      sheetName={sheetName}
                      selectedTarget={selectedTarget}
                      onSelectField={setSelectedTarget}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ) : !isLpType && (
          <>
            {isPortalType ? (
              <>
                <button
                  onClick={handleGeneratePortal}
                  disabled={portalGenerating || (!hpUrl.trim() && !portalGbpUrl.trim() && !hearing.trim())}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 rounded-xl transition-colors mb-8"
                >
                  {portalGenerating ? "情報収集・生成中..." : "ポータル原稿を生成"}
                </button>
                {portalGenError && <p className="text-red-500 text-sm mb-4">{portalGenError}</p>}
              </>
            ) : (
              <>
                <button
                  onClick={handleGenerate}
                  disabled={generating || (!project.hpContent && !hearing)}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 rounded-xl transition-colors mb-8"
                >
                  {generating ? "生成中..." : "ライティング生成"}
                </button>
                {genError && <p className="text-red-500 text-sm mb-4">{genError}</p>}
              </>
            )}
            {output && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-800">生成結果</h2>
                  {project.type === "meo" && (
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          const res = await fetch("/api/export/meo", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ output, projectName: project.name, hpUrl }),
                          });
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${project.name}_MEOヒヤリングシート.xlsx`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                      >
                        Excelダウンロード
                      </button>
                      <button
                        onClick={handleOpenMeoSheet}
                        disabled={openingMeoSheet}
                        className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                      >
                        {openingMeoSheet ? "処理中..." : "スプレッドシートで開く"}
                      </button>
                    </div>
                  )}
                  {project.type === "portal" && (
                    <div className="flex gap-2">
                      <button
                        onClick={handleDownloadPortal}
                        className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                      >
                        Excelダウンロード
                      </button>
                      <button
                        onClick={handleOpenPortalSheet}
                        disabled={openingPortalSheet}
                        className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                      >
                        {openingPortalSheet ? "処理中..." : "スプレッドシートで開く"}
                      </button>
                    </div>
                  )}
                </div>
                {isPortalType ? (
                  PORTAL_SECTION_GROUPS.map((group) => (
                    <div key={group.label} className="bg-white rounded-xl border border-gray-200 p-5">
                      <h3 className="font-semibold text-gray-700 text-sm mb-3 pb-2 border-b border-gray-100">{group.label}</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {(group.keys as readonly string[]).map((key) => (
                          <div key={key} className="space-y-0.5">
                            <p className="text-xs font-medium text-gray-500">{key}</p>
                            <p className="text-sm text-gray-800 bg-amber-50 rounded px-2 py-1.5 min-h-[2rem] whitespace-pre-wrap">
                              {String((output as Record<string, unknown>)[key] ?? "記載なし")}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <MeoOutputDisplay output={output} />
                )}
              </div>
            )}
          </>
        )}
      </div>

      {chatOutput && (
        <ChatBot
          projectId={id}
          currentOutput={chatOutput}
          onApply={handleChatApply}
          selectedTarget={selectedTarget}
          onClearTarget={() => setSelectedTarget(null)}
        />
      )}
    </main>
  );
}
