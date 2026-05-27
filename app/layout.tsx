import type { Metadata } from "next";
import { JetBrains_Mono, Work_Sans } from "next/font/google";
import "./globals.css";
import { NavigationProvider } from "@/lib/contexts/NavigationContext";

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "TradeAxis v2.0 — Miziba Platform",
  description: "Trade Finance Origination Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${workSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className={workSans.className} suppressHydrationWarning>
        <NavigationProvider>
          {children}
        </NavigationProvider>
      </body>
    </html>
  );
}
