import type { Metadata } from "next";
import { Noto_Sans_HK, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const notoSansHk = Noto_Sans_HK({
  variable: "--font-sans-hk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "MarkInsight | 試卷成績分析",
  description:
    "MarkInsight Web MVP — exam mark insight for teachers and students (scaffold).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-HK"
      className={`${notoSansHk.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-[family-name:var(--font-sans-hk)] text-[var(--ink)]">
        {children}
      </body>
    </html>
  );
}
