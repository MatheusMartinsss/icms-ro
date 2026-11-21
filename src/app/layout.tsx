import type { Metadata } from "next";
import { cn } from "@/lib/utils"
import { Inter as FontSans } from "next/font/google"
import Providers from "@/components/providers";
import Navbar from "@/components/navbar";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "GeraGuia: guias de tributos estaduais", template: "%s · GeraGuia" },
  description: "Calcule e gere guias de tributos estaduais: ICMS frete (DARE) em Rondônia, FETHAB em Mato Grosso e mais.",
};

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={cn(
        "min-h-screen bg-slate-50 font-sans antialiased",
        fontSans.variable
      )}>
        <Providers>
          <Navbar />
          {children}
        </Providers>
        {/* Umami (sem cookies). data-domains: não conta acessos locais. */}
        <Script
          src="/u/script.js"
          data-website-id="248646f6-d5fa-44a6-897a-6ce8fd2153a0"
          data-domains="geraguia.com.br,www.geraguia.com.br"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
