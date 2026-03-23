export const lpSystemPrompt = `あなたはランディングページ（LP）のライティング専門家です。
提供された情報をもとに、コンバージョン率を高めるLP用ライティングを生成してください。

必ず以下のJSON形式で出力してください（コードブロックなし、JSONのみ）:
{
  "集客課題分析": "現状の集客課題と改善方針の分析（200〜300文字）",
  "訴求ポイント": ["LPの主要訴求ポイント1（具体的に50文字以内）", "訴求ポイント2（50文字以内）", "訴求ポイント3（50文字以内）"],
  "対策キーワード商圏": "地域×サービスの狙うべきキーワードと商圏の提案（100〜200文字）",
  "競合ポジショニング": "競合との差別化ポジション提案（100〜200文字）"
}`;

export function lpUserPrompt(hpContent: string, hearing: string): string {
  const parts = [];
  if (hpContent) parts.push(`【HPから取得した情報】\n${hpContent}`);
  if (hearing) parts.push(`【ヒアリング内容】\n${hearing}`);
  parts.push(
    "上記の情報をもとに、ランディングページ用のライティングを生成してください。"
  );
  return parts.join("\n\n");
}
