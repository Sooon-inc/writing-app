import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as ExcelJS from "exceljs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { HP_TEMPLATE_PATHS } from "@/lib/hpSitemap";
import { formatLearningMemoriesForPrompt, listLearningMemories } from "@/lib/learningMemory";
import { jsonrepair } from "jsonrepair";

const client = new Anthropic();

export type ChatOutput =
  | { type: "meo" | "portal"; data: Record<string, unknown> }
  | { type: "hp"; data: Record<string, Record<number, string>>; themes: Record<string, string> }
  | { type: "lp"; data: Record<number, string> };

export type UpdatePayload =
  | { kind: "output"; diff: Record<string, unknown> }
  | { kind: "hp"; diff: Record<string, Record<string, string>> }
  | { kind: "lp"; diff: Record<string, string> };

type FieldMap = Map<number, { section: string; label: string }>;

// ── Excel ユーティリティ ──────────────────────────────────────────────

function getCellText(row: ExcelJS.Row, colIndex: number): string {
  const cell = row.getCell(colIndex);
  const v = cell.value;
  if (!v) return "";
  if (typeof v === "object" && "richText" in v)
    return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("").trim();
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return "";
}

function extractHpFieldMap(sheet: ExcelJS.Worksheet): FieldMap {
  const map: FieldMap = new Map();
  sheet.eachRow((row, rn) => {
    if (rn <= 4) return;
    const section = getCellText(row, 2).trim();
    const c5 = getCellText(row, 5);
    const c8 = getCellText(row, 8);
    const c13 = getCellText(row, 13);
    const label = (c5 || c8 || "").trim();
    if (!label || !section) return;
    if (label === "項目・要素" || label === "完成理想文字数") return;
    if (c13) return;
    if (label.includes("本文（文章") || label.includes("完成理想")) return;
    if (label.includes("ページ") && section.includes("ページ")) return;
    map.set(rn, { section, label });
  });
  return map;
}

function extractLpFieldMap(sheet: ExcelJS.Worksheet): FieldMap {
  const map: FieldMap = new Map();
  sheet.eachRow((row, rn) => {
    if (rn <= 8) return;
    const section = getCellText(row, 2).replace(/\n/g, " ").trim();
    const condition = getCellText(row, 4).trim();
    const label = getCellText(row, 5).trim();
    if (!label || !section) return;
    if (condition === "記入不要") return;
    if (label === "項目・要素") return;
    map.set(rn, { section, label });
  });
  return map;
}

// ── コンテキスト整形（項目名付き） ────────────────────────────────────

async function formatOutputForPrompt(
  currentOutput: ChatOutput,
  projectId: string
): Promise<string> {
  // MEO / Portal: フィールド名が既にある
  if (currentOutput.type === "meo" || currentOutput.type === "portal") {
    return Object.entries(currentOutput.data)
      .map(([k, v]) => `${k}: ${String(v ?? "")}`)
      .join("\n");
  }

  // LP
  if (currentOutput.type === "lp") {
    let fieldMap: FieldMap = new Map();
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(path.join(process.cwd(), "templates/lp/lp.xlsx"));
      const sheet = wb.getWorksheet("LP");
      if (sheet) fieldMap = extractLpFieldMap(sheet);
    } catch { /* fallback to row numbers */ }

    return Object.entries(currentOutput.data)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([rowNum, v]) => {
        const rn = parseInt(rowNum);
        const field = fieldMap.get(rn);
        return field
          ? `[${field.section}] ${field.label} (行${rn}): ${v}`
          : `行${rn}: ${v}`;
      })
      .join("\n");
  }

  // HP
  if (currentOutput.type !== "hp") return "";

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return "";

  // instanceKey → sheetName マッピング
  const instanceToSheet: Record<string, string> = {};
  try {
    if (project.sitemap) {
      const parsed = JSON.parse(project.sitemap) as Array<{ id: string; sheetName: string } | string>;
      for (const item of parsed) {
        if (typeof item === "string") instanceToSheet[item] = item;
        else if (item.id && item.sheetName) instanceToSheet[item.id] = item.sheetName;
      }
    }
  } catch { /* ignore */ }

  // テンプレートを1回だけ読み込み、必要なシートのフィールドマップを構築
  const fieldMaps: Record<string, FieldMap> = {};
  const templatePath = HP_TEMPLATE_PATHS[project.type];
  if (templatePath) {
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(path.join(process.cwd(), templatePath));
      for (const instanceKey of Object.keys(currentOutput.data)) {
        const sheetName = instanceToSheet[instanceKey] ?? instanceKey;
        if (!fieldMaps[sheetName]) {
          const sheet =
            wb.getWorksheet(sheetName) ??
            wb.worksheets.find((s) => s.name.trim() === sheetName.trim());
          if (sheet) fieldMaps[sheetName] = extractHpFieldMap(sheet);
        }
      }
    } catch { /* fallback to row numbers */ }
  }

  const hpOutput = currentOutput;
  return Object.entries(hpOutput.data)
    .map(([key, rows]) => {
      const theme = hpOutput.themes[key] ? `（テーマ: ${hpOutput.themes[key]}）` : "";
      const sheetName = instanceToSheet[key] ?? key;
      const fieldMap = fieldMaps[sheetName] ?? new Map();

      const rowLines = Object.entries(rows as Record<string, unknown>)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([rn, v]) => {
          const field = fieldMap.get(parseInt(rn));
          return field
            ? `  [${field.section}] ${field.label} (行${rn}): ${String(v)}`
            : `  行${rn}: ${String(v)}`;
        })
        .join("\n");
      return `【${key}${theme}】\n${rowLines}`;
    })
    .join("\n\n");
}

// ── UpdatePayload 構築 ────────────────────────────────────────────────

function buildUpdatePayload(diff: Record<string, unknown>, outputType: string): UpdatePayload | null {
  if (outputType === "hp") {
    const hpDiff: Record<string, Record<string, string>> = {};
    for (const [key, rows] of Object.entries(diff)) {
      if (rows && typeof rows === "object") {
        hpDiff[key] = Object.fromEntries(
          Object.entries(rows as Record<string, unknown>).map(([r, v]) => [r, String(v ?? "")])
        );
      }
    }
    return { kind: "hp", diff: hpDiff };
  }
  if (outputType === "lp") {
    const lpDiff: Record<string, string> = {};
    for (const [k, v] of Object.entries(diff)) {
      lpDiff[k] = String(v ?? "");
    }
    return { kind: "lp", diff: lpDiff };
  }
  return { kind: "output", diff };
}

function extractUpdateJsonBlock(text: string): { reply: string; diff: Record<string, unknown> | null } {
  const blockPattern = /```(?:json\s*:?\s*update|json-update|update|json)?\s*\n([\s\S]*?)\n```/gi;
  let match: RegExpExecArray | null;
  let selectedBlock = "";
  let reply = text;

  while ((match = blockPattern.exec(text)) !== null) {
    const block = match[1]?.trim() ?? "";
    const marker = match[0].slice(0, 40).toLowerCase();
    const looksLikeUpdate =
      marker.includes("update") ||
      block.includes("{") ||
      block.includes("}");
    if (!looksLikeUpdate) continue;

    selectedBlock = block;
    reply = reply.replace(match[0], "").trim();
  }

  if (!selectedBlock) return { reply: text.trim(), diff: null };

  try {
    const jsonStart = selectedBlock.indexOf("{");
    const jsonEnd = selectedBlock.lastIndexOf("}");
    const jsonText = jsonStart >= 0 && jsonEnd > jsonStart
      ? selectedBlock.slice(jsonStart, jsonEnd + 1)
      : selectedBlock;
    const parsed = JSON.parse(jsonrepair(jsonText)) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { reply, diff: parsed as Record<string, unknown> };
    }
  } catch {
    // 差分抽出に失敗した場合は修正案なしとして扱う
  }

  return { reply, diff: null };
}

function formatUnknownForPrompt(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => `${pad}${index + 1}. ${formatUnknownForPrompt(item, indent + 1)}`).join("\n");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, child]) => `${pad}${key}: ${formatUnknownForPrompt(child, indent + 1)}`)
      .join("\n");
  }
  return String(value);
}

// ── POST ─────────────────────────────────────────────────────────────

interface SelectedTarget {
  id?: string;
  instanceKey?: string;
  pageLabel?: string;
  fieldKey?: string;
  rn?: number;
  section?: string;
  label?: string;
  currentValue?: string;
  displayText: string;
  valueType?: "text" | "boolean";
}

export async function POST(req: NextRequest) {
  const { projectId, message, history, currentOutput, selectedTarget, selectedTargets } = (await req.json()) as {
    projectId: string;
    message: string;
    history: { role: "user" | "assistant"; content: string }[];
    currentOutput: ChatOutput;
    selectedTarget?: SelectedTarget | null;
    selectedTargets?: SelectedTarget[];
  };

  const formattedOutput = await formatOutputForPrompt(currentOutput, projectId);
  const learningMemories = await listLearningMemories(currentOutput.type, 8);
  const learningContext = formatLearningMemoriesForPrompt(learningMemories);

  const outputTypeLabel =
    currentOutput.type === "meo" ? "MEO原稿" :
    currentOutput.type === "portal" ? "ポータル原稿" :
    currentOutput.type === "hp" ? "HPヒアリング" :
    "LP原稿";

  const updateFormat =
    currentOutput.type === "hp"
      ? 'HP形式: {"ページキー（instanceKey）": {"行番号": "新しい値"}} — コンテキスト中の (行N) の番号を使うこと'
      : currentOutput.type === "lp"
      ? '{"行番号": "新しい値"} — コンテキスト中の (行N) の番号を使うこと'
      : currentOutput.type === "meo"
      ? 'MEO形式: {"フィールド名またはパス": 新しい値} — 例: {"基本情報.住所": "新住所", "強み": ["強み1", "強み2"], "商品サービス": [{...}]}。配列・オブジェクト項目は配列・オブジェクトのまま返すこと'
      : '{"フィールド名": "新しい値"} — 修正するフィールドのみ含める';

  const targets = Array.isArray(selectedTargets) && selectedTargets.length > 0
    ? selectedTargets
    : selectedTarget
    ? [selectedTarget]
    : [];

  // 修正対象が指定されている場合の追加指示
  const targetInstruction = targets.length > 0
    ? (() => {
        const lines = [
          "",
          "【修正対象（ユーザーが指定）】",
          `対象数: ${targets.length}`,
        ];
        targets.forEach((target, index) => {
          lines.push(`\n${index + 1}. 項目: ${target.displayText}`);
          if (target.instanceKey) lines.push(`ページキー: ${target.instanceKey}`);
          if (target.fieldKey) lines.push(`フィールド名: ${target.fieldKey}`);
          if (target.rn) lines.push(`行番号: ${target.rn}`);
          if (target.valueType) lines.push(`値の形式: ${target.valueType}`);
          if (target.currentValue) lines.push(`現在の値: ${target.currentValue}`);
        });
        lines.push(
          "",
          "⚠️ 上記の指定された項目のみを、ユーザーの同じ指示に沿って修正すること。他の項目は絶対に変更しないこと。",
          "複数項目が指定されている場合は、各項目の役割（タイトル・本文・質問・回答など）に合わせて自然に書き分けること。",
          "ユーザーが「追加して」と言った場合は、同じセクション内に新しい行を追加する提案をすること。",
        );
        return lines.join("\n");
      })()
    : "";

  const systemPrompt = `あなたは日本語のライティング修正アシスタントです。
以下の生成済み${outputTypeLabel}コンテンツを参照し、ユーザーの修正依頼に日本語で丁寧に答えてください。
${targetInstruction}
【現在のコンテンツ】
${currentOutput.type === "meo" ? formatUnknownForPrompt(currentOutput.data) : formattedOutput}
${learningContext ? `\n【過去にユーザーが学習させた修正例】\n${learningContext}\n\n【学習例の使い方】\n- 学習例は、文体・言い換え方・削除/追加の判断基準として参考にすること\n- ただし、今回の修正対象・業種・文脈と矛盾する内容はそのまま流用しないこと\n- 固有名詞・数字・住所・サービス名は現在のコンテンツとユーザー指示を優先すること` : ""}

【修正がある場合のルール】
- 回答の末尾に、必ず以下の形式の更新JSONブロックを含めること:
\`\`\`json:update
{ ... }
\`\`\`
- ${updateFormat}
- 修正不要な場合や質問だけの場合は、updateブロックを含めないこと
- updateブロックには修正箇所のみ含め、変更なしの項目は含めないこと`;

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: message },
  ];

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  const text = (msg.content[0] as { type: string; text: string }).text;
  const extracted = extractUpdateJsonBlock(text);
  const reply = extracted.reply;
  let updates: UpdatePayload | null = null;
  if (extracted.diff) {
    updates = buildUpdatePayload(extracted.diff, currentOutput.type);
  }

  return NextResponse.json({ reply, updates });
}
