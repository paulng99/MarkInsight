import type { Metadata, Viewport } from "next";
import { Noto_Sans_HK, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
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
      data-scroll-behavior="smooth"
      className={`${notoSansHk.variable} ${displayFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans text-[var(--ink)]">
        <Script id="sidebar-pref" strategy="beforeInteractive">
          {`(function(){try{var k="markinsight.sidebar";var s=localStorage.getItem(k);if(s!=="collapsed"&&s!=="expanded"){s=matchMedia("(max-width:1399px)").matches?"collapsed":"expanded"}document.documentElement.setAttribute("data-sidebar",s)}catch(e){}})();`}
        </Script>
        {children}
      </body>
    </html>
  );
}
