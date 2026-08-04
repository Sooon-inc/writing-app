import { NextResponse } from "next/server";
import { ensureMeoOutput } from "@/lib/meoOutput";
import { reviewAndReviseMeoSinglePass } from "@/lib/meoQuality";

export const maxDuration = 300;

const QUALITY_TIMEOUT_MS = 230_000;

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

    const checked = await withHardTimeout(
      reviewAndReviseMeoSinglePass(initialOutput, evidence, {
        maxAttempts: 1,
        timeoutMs: 210_000,
        maxTokens: 8192,
      }),
      QUALITY_TIMEOUT_MS
    );
    const reviewedOutput = ensureMeoOutput(checked.output);
    console.log(`[meo-review] completed in ${Date.now() - startedAt}ms`);

    return NextResponse.json({
      output: reviewedOutput,
      qualityReview: checked.review,
      qualityRevisionAttempts: checked.attempts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[meo-review] failed:", message);
    return NextResponse.json({ error: message || "MEO品質確認に失敗しました" }, { status: 500 });
  }
}
