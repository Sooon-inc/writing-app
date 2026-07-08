const MEO_REQUIRED_MARKERS = ["基本情報", "店舗説明文", "商品サービス", "サービス"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function looksLikeMeoOutput(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  return MEO_REQUIRED_MARKERS.some((key) => key in value);
}

export function normalizeMeoOutput(value: unknown): Record<string, unknown> | null {
  if (looksLikeMeoOutput(value)) return value;

  if (typeof value === "string") {
    try {
      return normalizeMeoOutput(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeMeoOutput(item);
      if (normalized) return normalized;
    }
  }

  if (isRecord(value)) {
    for (const item of Object.values(value)) {
      const normalized = normalizeMeoOutput(item);
      if (normalized) return normalized;
    }
  }

  return null;
}

export function ensureMeoOutput(value: unknown): Record<string, unknown> {
  const normalized = normalizeMeoOutput(value);
  if (!normalized) {
    throw new Error("MEO生成結果のJSON形式が不正です。正しいMEO出力オブジェクトを取得できませんでした。");
  }
  return normalized;
}
