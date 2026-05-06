import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "폴스비 Firstfruits",
  description: "Link Harvest Archive",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
