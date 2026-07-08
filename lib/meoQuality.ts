import { jsonrepair } from "jsonrepair";
import { generateWriting } from "@/lib/claude";

type MeoReport = {
  passed: boolean;
  score: number;
  issues: Array<{
    id: string;
    severity: "high" | "mid" | "low";
    evidence: string;
    reason: string;
    instruction: string;
  }>;
  summary: string;
};

const REVIEW_PROMPT = `あなたはGoogleビジネスプロフィールとローカルSEOの監査担当者です。
生成されたMEO初期設計を、提供情報・調査情報・Google公式方針に照らして厳格に確認してください。

【公式方針として確認する内容】
- ローカル検索は主に関連性・距離・知名度で決まる。順位保証はしない。
- 住所、電話番号、営業時間、業種などは完全で正確な情報を優先する。
- ビジネス名へ地域名・サービス名・宣伝文句を不正に追加しない。
- カテゴリは「この事業は何か」を表す、少数かつ具体的なものにする。サービス一覧をカテゴリとして並べない。
- ビジネス説明は顧客に有用なサービス・商品・使命・沿革を記載し、リンク、価格訴求、セール、誇大表現を入れない。
- サービス提供地域や営業時間を推測しない。
- Web調査の一般的なトレンドを、その会社固有の実績・特徴として書かない。
- 不自然な地域名やキーワードの反復を避ける。
- 各サービスは実在が確認できるものを優先し、未確認の提案は提案欄だけに分離する。
- 顧客の悩み、地域特性、具体的なサービス内容が自然につながっている。

以下のJSONのみ返してください。
{
  "passed": true,
  "score": 0,
  "issues": [
    {
      "id": "fact_or_policy_issue",
      "severity": "high",
      "evidence": "生成文から正確に引用",
      "reason": "問題の理由",
      "instruction": "修正指示"
    }
  ],
  "summary": "監査所見"
}

scoreは100点満点で、重大な事実誤認・ポリシー違反を重く減点してください。issuesは問題があるものだけにしてください。`;

const REVISION_PROMPT = `あなたはMEO設計の修正担当者です。
監査結果に従って入力JSONを修正してください。

ルール:
- JSONのキー構造を維持し、JSONのみ返す。
- 住所、電話、営業時間、会社名、日付、価格、URL、Place ID、緯度経度は、根拠情報と一致する場合のみ残す。
- 根拠のない実績、特徴、地域事情、ランキング効果、保証は削除する。
- Webトレンドは顧客ニーズや表現方針の参考に限定し、会社の事実に変換しない。
- ビジネス説明にURL、セール、価格訴求、キーワード羅列を入れない。
- 地域名は自然な文脈でのみ使う。
- 未確認のサービスは「商品サービス提案」にのみ入れる。
- 事実情報が不明なら「情報なし」とする。`;

function parse<T>(raw: string): T {
  const cleaned = extractJsonObject(raw);
  return JSON.parse(jsonrepair(cleaned)) as T;
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    const inner = fenced[1].trim();
    const innerStart = inner.indexOf("{");
    const innerEnd = inner.lastIndexOf("}");
    if (innerStart !== -1 && innerEnd > innerStart) return inner.slice(innerStart, innerEnd + 1);
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1);

  return trimmed;
}

export async function reviewAndReviseMeo<T>(
  initialOutput: T,
  evidence: string
): Promise<{ output: T; review: MeoReport; attempts: number }> {
  let output = initialOutput;
  let attempts = 0;
  let review = parse<MeoReport>(await generateWriting(
    REVIEW_PROMPT,
    `【根拠情報】\n${evidence}\n\n【生成結果】\n${JSON.stringify(output)}`
  ));

  while (attempts < 2 && (!review.passed || review.score < 85 || review.issues?.some((issue) => issue.severity !== "low"))) {
    attempts += 1;
    output = parse<T>(await generateWriting(
      REVISION_PROMPT,
      `【根拠情報】\n${evidence}\n\n【監査結果】\n${JSON.stringify(review)}\n\n【修正対象JSON】\n${JSON.stringify(output)}`
    ));
    review = parse<MeoReport>(await generateWriting(
      REVIEW_PROMPT,
      `【根拠情報】\n${evidence}\n\n【生成結果】\n${JSON.stringify(output)}`
    ));
  }

  return { output, review, attempts };
}
