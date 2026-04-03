export type SitemapPage = {
  no: number;
  label: string;
  level: 1 | 2 | 3;
  sheetName: string | null; // null = no corresponding Excel sheet
  fixed?: boolean; // always included, cannot be removed
};

export const HP_SITEMAPS: Record<string, SitemapPage[]> = {
  "hp-classic": [
    // --- 固定ページ ---
    { no: 1,  label: "トップ",               level: 1, sheetName: "トップ",       fixed: true },
    { no: 2,  label: "当社について",          level: 2, sheetName: "当社について",  fixed: true },
    { no: 9,  label: "会社概要",              level: 2, sheetName: "会社概要",     fixed: true },
    { no: 10, label: "よくある質問",           level: 2, sheetName: "よくある質問", fixed: true },
    { no: 11, label: "代表挨拶・スタッフ紹介",  level: 2, sheetName: "代表挨拶",    fixed: true },
    // --- 任意ページ ---
    { no: 3,  label: "サービス紹介（A型）",    level: 2, sheetName: "サービス（A型）" },
    { no: 4,  label: "サービス紹介（B型）",    level: 2, sheetName: "【option】サービス（B型）" },
    { no: 5,  label: "サービス紹介（C型）",    level: 2, sheetName: "【option】サービス（C型）" },
    { no: 6,  label: "ご利用の流れ",           level: 2, sheetName: "【option】ご利用の流れ" },
    { no: 7,  label: "採用情報",               level: 2, sheetName: "採用情報" },
    { no: 8,  label: "採用LP",                level: 2, sheetName: "【option】採用LP" },
    { no: 12, label: "お知らせ・ブログ（一覧）", level: 2, sheetName: null },
    { no: 13, label: "お知らせ・ブログ（詳細）", level: 3, sheetName: null },
    { no: 14, label: "施工事例（一覧）",        level: 2, sheetName: null },
    { no: 15, label: "施工事例（詳細）",        level: 3, sheetName: null },
    { no: 16, label: "お問い合わせ（入力）",     level: 2, sheetName: null },
    { no: 17, label: "個人情報保護方針",         level: 2, sheetName: null },
  ],
  "hp-strong": [
    // --- 固定ページ ---
    { no: 1,  label: "トップ",               level: 1, sheetName: "トップ",            fixed: true },
    { no: 2,  label: "当社について",          level: 2, sheetName: "当社について",       fixed: true },
    { no: 10, label: "会社概要",              level: 2, sheetName: "会社概要",           fixed: true },
    { no: 11, label: "よくある質問",           level: 2, sheetName: "よくある質問",       fixed: true },
    { no: 12, label: "代表挨拶・スタッフ紹介",  level: 2, sheetName: "代表挨拶・スタッフ紹介", fixed: true },
    // --- 任意ページ ---
    { no: 3,  label: "サービス（A型）",        level: 2, sheetName: "サービス（A型）" },
    { no: 4,  label: "サービス（B型）",        level: 2, sheetName: "サービス（B型）" },
    { no: 5,  label: "サービス（C型）",        level: 2, sheetName: "サービス（C型）" },
    { no: 6,  label: "施工事例",               level: 2, sheetName: "施工事例" },
    { no: 7,  label: "ご依頼までの流れ",        level: 2, sheetName: "【option】ご依頼までの流れ" },
    { no: 8,  label: "採用情報",               level: 2, sheetName: "採用情報" },
    { no: 9,  label: "採用LP",                level: 2, sheetName: "【option】採用LP" },
    { no: 13, label: "お知らせ・ブログ（一覧）", level: 2, sheetName: null },
    { no: 14, label: "お知らせ・ブログ（詳細）", level: 3, sheetName: null },
    { no: 15, label: "施工事例（詳細）",        level: 3, sheetName: null },
    { no: 16, label: "お問い合わせ（入力）",     level: 2, sheetName: null },
    { no: 17, label: "個人情報保護方針",         level: 2, sheetName: null },
  ],
  "hp-beauty": [
    // --- 固定ページ ---
    { no: 1,  label: "トップ",    level: 1, sheetName: "トップ",    fixed: true },
    { no: 2,  label: "コンセプト", level: 2, sheetName: "コンセプト", fixed: true },
    { no: 13, label: "会社情報",   level: 2, sheetName: "会社情報",  fixed: true },
    // --- 任意ページ ---
    { no: 3,  label: "サロン紹介",                       level: 2, sheetName: "サロン紹介" },
    { no: 4,  label: "メニュー",                          level: 2, sheetName: "メニュー" },
    { no: 5,  label: "スタイルギャラリー（ライトボックス）", level: 2, sheetName: "スタイルギャラリー（ライトボックス）" },
    { no: 6,  label: "スタイルギャラリー（個別詳細有）",    level: 2, sheetName: "【option】スタイルギャラリー（個別詳細有）" },
    { no: 7,  label: "スタッフ紹介（一覧）",               level: 2, sheetName: "スタッフ紹介" },
    { no: 8,  label: "サービス紹介（A型）",                level: 2, sheetName: "サービス紹介（A型）" },
    { no: 9,  label: "サービス紹介（B型）",                level: 2, sheetName: "【option】サービス紹介（B型）" },
    { no: 10, label: "サービス紹介（C型）",                level: 2, sheetName: "【option】サービス紹介（C型）" },
    { no: 11, label: "お客様の声",                        level: 2, sheetName: "【option】お客様の声" },
    { no: 12, label: "プロダクト",                        level: 2, sheetName: "【option】プロダクト" },
    { no: 14, label: "採用情報",                          level: 2, sheetName: "採用情報" },
    { no: 15, label: "採用情報LP",                        level: 2, sheetName: "【option】採用情報LP" },
    { no: 16, label: "スタッフ紹介（詳細）",               level: 3, sheetName: null },
    { no: 17, label: "ブログ＆ニュース（一覧）",            level: 2, sheetName: null },
    { no: 18, label: "ブログ＆ニュース（詳細）",            level: 3, sheetName: null },
    { no: 19, label: "お問い合わせ（入力）",               level: 2, sheetName: null },
    { no: 20, label: "プライバシーポリシー",               level: 2, sheetName: null },
  ],
  "hp-recruit": [
    // --- 固定ページ (ユーザー指定なし → トップのみ固定) ---
    { no: 1,  label: "トップ",                    level: 1, sheetName: "トップ", fixed: true },
    // --- 任意ページ ---
    { no: 2,  label: "当社のお仕事",               level: 2, sheetName: "当社のお仕事" },
    { no: 3,  label: "スタッフインタビュー",         level: 2, sheetName: "スタッフインタビュー" },
    { no: 4,  label: "社員として働く",              level: 2, sheetName: "社員として働く" },
    { no: 5,  label: "アルバイトとして働く",         level: 2, sheetName: "アルバイトとして働く" },
    { no: 6,  label: "新卒採用",                   level: 2, sheetName: "新卒採用（募集要項・エントリー順）" },
    { no: 7,  label: "中途採用",                   level: 2, sheetName: "中途採用（募集要項・エントリー順） " }, // trailing space in Excel
    { no: 8,  label: "よくある質問",               level: 2, sheetName: "よくある質問" },
    { no: 9,  label: "会社概要",                   level: 2, sheetName: "会社概要" },
    { no: 10, label: "代表メッセージ",              level: 2, sheetName: "代表メッセージ" },
    { no: 11, label: "当社の取り組み",              level: 2, sheetName: "【option】当社の取り組み" },
    { no: 12, label: "教育フロー",                 level: 2, sheetName: "【option】教育フロー" },
    { no: 13, label: "スタッフインタビュー（詳細）", level: 3, sheetName: null },
    { no: 14, label: "お問い合わせ（入力）",         level: 2, sheetName: null },
    { no: 15, label: "プライバシーポリシー",         level: 2, sheetName: null },
  ],
};

export const HP_TEMPLATE_PATHS: Record<string, string> = {
  "hp-classic": "templates/hp/classic.xlsx",
  "hp-strong":  "templates/hp/strong.xlsx",
  "hp-beauty":  "templates/hp/beauty.xlsx",
  "hp-recruit": "templates/hp/recruit.xlsx",
};
