import type { Metadata } from "next";
import { cn } from "@/lib/utils"
import { Inter as FontSans } from "next/font/google"
import Providers from "@/components/providers";
import Navbar from "@/components/navbar";
import Rodape from "@/components/rodape";
import Script from "next/script";
import { SITE_NOME, SITE_URL } from "@/lib/site";
import "./globals.css";

const DESCRICAO = "Calcule e gere online a guia do ICMS do frete em Rondônia (DARE SEFIN-RO) e do FETHAB em Mato Grosso (DAR SEFAZ-MT), a partir do XML da NF-e. Grátis e sem cadastro.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "GeraGuia: ICMS frete RO e FETHAB MT, guia pronta para pagar", template: "%s · GeraGuia" },
  description: DESCRICAO,
  applicationName: SITE_NOME,
  alternates: { canonical: "/" },
  openGraph: {
    title: "GeraGuia: ICMS frete RO e FETHAB MT, guia pronta para pagar",
    description: DESCRICAO,
    url: "/",
    siteName: SITE_NOME,
    locale: "pt_BR",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
})

// Dados estruturados para o Google entender o que é o site.
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NOME,
  url: SITE_URL,
  inLanguage: "pt-BR",
  description: DESCRICAO,
};

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
          <Rodape />
        </Providers>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
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
