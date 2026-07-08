import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ライティング自動化",
  description: "MEO・HP・LPのライティングを自動生成",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
