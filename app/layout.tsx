import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ARTAS — Architektura komfortu",
  description: "Rolety, bramy i pergole. Poznaj rozwiązania ARTAS, odkryj ich konstrukcję w 3D i przymierz je do swojego domu.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body className={`${montserrat.variable} antialiased`}>{children}</body>
    </html>
  );
}
