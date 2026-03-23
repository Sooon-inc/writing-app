const toneGuide: Record<string, string> = {
  "hp-strong":
    "力強く、信頼感・実績を前面に出した文体。ビジネスライクで専門性を感じさせる。",
  "hp-classic":
    "品格があり落ち着いた文体。伝統・信頼・安心感を重視した表現。",
  "hp-beauty":
    "洗練されておしゃれな文体。美しさ・センス・ライフスタイルを重視した表現。",
  "hp-recruit":
    "活気があり親しみやすい文体。働きやすさ・成長・チームワークを強調した表現。",
};

export function hpSystemPrompt(type: string): string {
  const tone = toneGuide[type] ?? toneGuide["hp-strong"];
  return `あなたはホームページ（HP）のライティング専門家です。
文体指針: ${tone}

提供された情報をもとに、効果的なHP用ライティングを生成してください。

必ず以下のJSON形式で出力してください（コードブロックなし、JSONのみ）:
{
  "打ち出す事業内容": "メインキャッチコピー（30〜50文字）。事業の核心を一言で表す",
  "独自性ポイント": ["他社との差別化ポイント1（20文字以内）", "ポイント2（20文字以内）", "ポイント3（20文字以内）"],
  "ブランディングコピー": "お客様への訴求メッセージ（50〜100文字）。感情に訴える表現",
  "対策キーワード": ["SEO対策キーワード1", "キーワード2", "キーワード3", "キーワード4", "キーワード5"],
  "サービス説明": "事業・サービスの詳細説明テキスト（200〜400文字）"
}`;
}

export function hpUserPrompt(hpContent: string, hearing: string): string {
  const parts = [];
  if (hpContent) parts.push(`【HPから取得した情報】\n${hpContent}`);
  if (hearing) parts.push(`【ヒアリング内容】\n${hearing}`);
  parts.push(
    "上記の情報をもとに、ホームページ用のライティングを生成してください。"
  );
  return parts.join("\n\n");
}
