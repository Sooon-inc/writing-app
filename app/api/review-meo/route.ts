import { NextResponse } from "next/server";
import { ensureMeoOutput } from "@/lib/meoOutput";
import { MeoReport, reviewAndReviseMeoSinglePass } from "@/lib/meoQuality";

export const maxDuration = 300;

const QUALITY_TIMEOUT_MS = 230_000;
const LARGE_LIST_CHUNK_COUNT = 2;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asRecordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function mergeRecordList(
  original: JsonRecord[],
  reviewed: JsonRecord[],
  identityKey: string
): JsonRecord[] {
  return original.map((item, index) => {
    const identity = typeof item[identityKey] === "string" ? item[identityKey] : "";
    const matched = identity
      ? reviewed.find((candidate) => candidate[identityKey] === identity)
      : undefined;
    const candidate = matched ?? reviewed[index];
    return candidate ? { ...item, ...candidate } : item;
  });
}

function preservePrimitiveList(original: unknown, reviewed: unknown): unknown {
  if (!Array.isArray(original)) return reviewed;
  if (!Array.isArray(reviewed) || reviewed.length !== original.length) return original;
  return reviewed;
}

function buildReviewChunks(initialOutput: JsonRecord): JsonRecord[] {
  const products = asRecordArray(initialOutput["商品サービス"]);
  const services = asRecordArray(initialOutput["サービス"]);
  const core: JsonRecord = {
    ...initialOutput,
    "商品サービス": [],
    "サービス": [],
  };
  if (products.length === 0 && services.length === 0) return [core];

  const chunks: JsonRecord[] = [core];
  for (let index = 0; index < LARGE_LIST_CHUNK_COUNT; index += 1) {
    const productStart = Math.ceil(products.length * index / LARGE_LIST_CHUNK_COUNT);
    const productEnd = Math.ceil(products.length * (index + 1) / LARGE_LIST_CHUNK_COUNT);
    const serviceStart = Math.ceil(services.length * index / LARGE_LIST_CHUNK_COUNT);
    const serviceEnd = Math.ceil(services.length * (index + 1) / LARGE_LIST_CHUNK_COUNT);
    chunks.push({
      "商品サービス": products.slice(productStart, productEnd),
      "サービス": services.slice(serviceStart, serviceEnd),
    });
  }
  return chunks;
}

function mergeReviewedChunks(initialOutput: JsonRecord, reviewedChunks: JsonRecord[]): JsonRecord {
  const reviewedCore = reviewedChunks[0] ?? {};
  const reviewedProducts = reviewedChunks.slice(1).flatMap((chunk) => asRecordArray(chunk["商品サービス"]));
  const reviewedServices = reviewedChunks.slice(1).flatMap((chunk) => asRecordArray(chunk["サービス"]));
  const originalProducts = asRecordArray(initialOutput["商品サービス"]);
  const originalServices = asRecordArray(initialOutput["サービス"]);

  const merged: JsonRecord = {
    ...initialOutput,
    ...reviewedCore,
    "商品サービス": mergeRecordList(originalProducts, reviewedProducts, "商品サービス名"),
    "サービス": mergeRecordList(originalServices, reviewedServices, "サービス名"),
  };

  for (const key of ["強み", "狙うキーワード", "ユーザーの悩み", "商品サービス提案"]) {
    merged[key] = preservePrimitiveList(initialOutput[key], reviewedCore[key]);
  }

  const originalSurvey = isRecord(initialOutput["アンケート"]) ? initialOutput["アンケート"] : {};
  const reviewedSurvey = isRecord(reviewedCore["アンケート"]) ? reviewedCore["アンケート"] : {};
  const originalQuestions = asRecordArray(originalSurvey["質問リスト"]);
  const reviewedQuestions = asRecordArray(reviewedSurvey["質問リスト"]);
  merged["アンケート"] = {
    ...originalSurvey,
    ...reviewedSurvey,
    "質問リスト": mergeRecordList(originalQuestions, reviewedQuestions, "質問"),
  };

  return merged;
}

function aggregateReports(reports: MeoReport[]): MeoReport {
  return {
    passed: reports.every((report) => report.passed),
    score: reports.length
      ? Math.round(reports.reduce((sum, report) => sum + report.score, 0) / reports.length)
      : 0,
    issues: reports.flatMap((report) => report.issues),
    summary: reports.map((report) => report.summary).filter(Boolean).join(" / "),
  };
}

function withHardTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("MEO品質確認が時間内に完了しませんでした。もう一度実行してください。")),
      timeoutMs
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  try {
    const { output, evidence } = (await req.json()) as {
      output?: unknown;
      evidence?: string;
    };
    const initialOutput = ensureMeoOutput(output);
    if (!evidence?.trim()) {
      return NextResponse.json({ error: "品質確認用の根拠情報がありません" }, { status: 400 });
    }

    const reviewChunks = buildReviewChunks(initialOutput);
    const checkedChunks = await withHardTimeout(
      Promise.all(reviewChunks.map((chunk) => reviewAndReviseMeoSinglePass(chunk, evidence, {
          maxAttempts: 1,
          timeoutMs: 210_000,
          maxTokens: 8192,
        })
      )),
      QUALITY_TIMEOUT_MS
    );
    const reviewedOutput = ensureMeoOutput(mergeReviewedChunks(
      initialOutput,
      checkedChunks.map((checked) => ensureMeoOutput(checked.output))
    ));
    const qualityReview = aggregateReports(checkedChunks.map((checked) => checked.review));
    console.log(
      `[meo-review] completed ${reviewChunks.length} chunks in ${Date.now() - startedAt}ms; `
      + `products=${asRecordArray(reviewedOutput["商品サービス"]).length}; `
      + `services=${asRecordArray(reviewedOutput["サービス"]).length}`
    );

    return NextResponse.json({
      output: reviewedOutput,
      qualityReview,
      qualityRevisionAttempts: 1,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[meo-review] failed:", message);
    return NextResponse.json({ error: message || "MEO品質確認に失敗しました" }, { status: 500 });
  }
}
