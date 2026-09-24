import type { Metadata, Viewport } from "next";
import { Noto_Sans_HK, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const notoSansHk = Noto_Sans_HK({
  variable: "--font-sans-hk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const displayFont = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MarkInsight | 試卷成績分析",
    template: "%s · MarkInsight",
  },
  description:
    "MarkInsight turns exam scripts into topic-level insight for teachers and students. 試卷成績分析，協助教師與學生掌握弱項。",
  applicationName: "MarkInsight",
};

export const viewport: Viewport = {
  themeColor: "#2450e9",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-HK"
      className={`${notoSansHk.variable} ${displayFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans text-[var(--ink)]">
        {children}
      </body>
    </html>
  );
}
