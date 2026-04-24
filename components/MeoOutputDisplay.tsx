interface SurveyQuestion {
  質問: string;
  選択肢: string[];
}

interface ProductService {
  商品サービス名?: string;
  商品カテゴリ?: string;
  商品価格?: string;
  商品説明?: string;
}

interface Service {
  サービス名?: string;
  説明文?: string;
}

interface MeoData {
  基本情報?: Record<string, string>;
  最寄り駅?: string;
  ジャンル?: string;
  店舗説明文?: string;
  強み?: string[];
  狙うキーワード?: string[];
  ユーザーの悩み?: string[];
  商品サービス?: ProductService[];
  アンケート?: {
    アンケート名?: string;
    口コミ追加キーワード?: string;
    質問リスト?: SurveyQuestion[];
  };
  サービス?: Service[];
  商品サービス提案?: string[];
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-5 py-2.5 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function KvTable({ entries }: { entries: [string, string][] }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k} className="border-b border-gray-50 last:border-0">
            <td className="py-1.5 pr-4 text-xs text-gray-500 align-top whitespace-nowrap w-36">{k}</td>
            <td className="py-1.5 text-gray-800 align-top whitespace-pre-wrap">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TagList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <span key={i} className="bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full whitespace-pre-wrap">
          {item}
        </span>
      ))}
    </div>
  );
}

export default function MeoOutputDisplay({ output }: { output: Record<string, unknown> }) {
  const meo = output as MeoData;

  return (
    <div className="space-y-4">
      {/* 基本情報 */}
      {meo.基本情報 && Object.keys(meo.基本情報).length > 0 && (
        <SectionCard title="基本情報">
          <KvTable entries={Object.entries(meo.基本情報)} />
        </SectionCard>
      )}

      {/* 店舗情報 */}
      {(meo.最寄り駅 || meo.ジャンル) && (
        <SectionCard title="店舗情報">
          <KvTable entries={[
            ...(meo.最寄り駅 ? [["最寄り駅", meo.最寄り駅] as [string, string]] : []),
            ...(meo.ジャンル ? [["ジャンル", meo.ジャンル] as [string, string]] : []),
          ]} />
        </SectionCard>
      )}

      {/* 店舗説明文 */}
      {meo.店舗説明文 && (
        <SectionCard title="店舗説明文">
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{meo.店舗説明文}</p>
        </SectionCard>
      )}

      {/* 強み */}
      {meo.強み && meo.強み.length > 0 && (
        <SectionCard title="強み">
          <TagList items={meo.強み} />
        </SectionCard>
      )}

      {/* 狙うキーワード */}
      {meo.狙うキーワード && meo.狙うキーワード.length > 0 && (
        <SectionCard title="狙うキーワード">
          <TagList items={meo.狙うキーワード} />
        </SectionCard>
      )}

      {/* ユーザーの悩み */}
      {meo.ユーザーの悩み && meo.ユーザーの悩み.length > 0 && (
        <SectionCard title="ユーザーの悩み">
          <ul className="space-y-1.5">
            {meo.ユーザーの悩み.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-800">
                <span className="text-gray-300 shrink-0">{i + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* 商品サービス */}
      {meo.商品サービス && meo.商品サービス.length > 0 && (
        <SectionCard title="商品サービス">
          <div className="space-y-4">
            {meo.商品サービス.map((s, i) => (
              <div key={i} className="border border-gray-100 rounded-lg overflow-hidden">
                <div className="bg-blue-50 px-3 py-2 flex items-center gap-2">
                  <span className="text-xs font-semibold text-blue-700">{s.商品サービス名}</span>
                  {s.商品カテゴリ && (
                    <span className="text-xs text-blue-400">{s.商品カテゴリ}</span>
                  )}
                </div>
                {s.商品説明 && (
                  <p className="px-3 py-2.5 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{s.商品説明}</p>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* サービス */}
      {meo.サービス && meo.サービス.length > 0 && (
        <SectionCard title="サービス">
          <div className="space-y-4">
            {meo.サービス.map((s, i) => (
              <div key={i} className="border border-gray-100 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2">
                  <span className="text-xs font-semibold text-gray-700">{s.サービス名}</span>
                </div>
                {s.説明文 && (
                  <p className="px-3 py-2.5 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{s.説明文}</p>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* アンケート */}
      {meo.アンケート && (
        <SectionCard title="アンケート">
          <div className="space-y-4">
            {meo.アンケート.アンケート名 && (
              <KvTable entries={[
                ["アンケート名", meo.アンケート.アンケート名],
                ...(meo.アンケート.口コミ追加キーワード
                  ? [["口コミ追加KW", meo.アンケート.口コミ追加キーワード] as [string, string]]
                  : []),
              ]} />
            )}
            {meo.アンケート.質問リスト && meo.アンケート.質問リスト.length > 0 && (
              <div className="space-y-3 mt-2">
                {meo.アンケート.質問リスト.map((q, i) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Q{i + 1}. {q.質問}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {q.選択肢?.map((c, j) => (
                        <span key={j} className="bg-gray-50 text-gray-600 text-xs px-2 py-0.5 rounded border border-gray-200">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* 商品サービス提案 */}
      {meo.商品サービス提案 && meo.商品サービス提案.length > 0 && (
        <SectionCard title="商品サービス提案">
          <ul className="space-y-1.5">
            {meo.商品サービス提案.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-800">
                <span className="text-gray-300 shrink-0">{i + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
