import type { Metadata } from "next";
import { cn } from "@/lib/utils"
import { Inter as FontSans } from "next/font/google"
import Providers from "@/components/providers";
import Navbar from "@/components/navbar";
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
      </body>
    </html>
  );
}
