import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 529]);
const RETRYABLE_ERROR_TYPES = new Set([
  "overloaded_error",
  "rate_limit_error",
  "api_error",
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const maybe = error as { status?: unknown; statusCode?: unknown };
  const status = typeof maybe.status === "number" ? maybe.status : maybe.statusCode;
  return typeof status === "number" ? status : undefined;
}

function getErrorType(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const maybe = error as {
    type?: unknown;
    error?: { type?: unknown };
  };
  if (typeof maybe.type === "string") return maybe.type;
  if (typeof maybe.error?.type === "string") return maybe.error.type;
  return "";
}

function isRetryableClaudeError(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status && RETRYABLE_STATUS_CODES.has(status)) return true;

  const type = getErrorType(error);
  if (RETRYABLE_ERROR_TYPES.has(type)) return true;

  const message = error instanceof Error ? error.message : String(error);
  return /overloaded|rate.?limit|529|temporarily unavailable/i.test(message);
}

function toReadableClaudeError(error: unknown): Error {
  if (isRetryableClaudeError(error)) {
    return new Error("AI生成サーバーが混み合っています。少し時間を置いてもう一度実行してください。");
  }
  return error instanceof Error ? error : new Error(String(error));
}

export async function generateWriting(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const maxAttempts = 4;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const content = message.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type from Claude");
      }

      return content.text;
    } catch (error) {
      lastError = error;
      if (!isRetryableClaudeError(error) || attempt === maxAttempts) break;

      const baseDelay = 1200 * 2 ** (attempt - 1);
      const jitter = Math.floor(Math.random() * 500);
      await sleep(baseDelay + jitter);
    }
  }

  throw toReadableClaudeError(lastError);
}
