import type { Metadata } from "next";
import { cn } from "@/lib/utils"
import { Inter as FontSans } from "next/font/google"
import { Toaster } from "sonner"
import "./globals.css";

export const metadata: Metadata = {
  title: "FreteCalc",
  description: "Calculadora de ICMS e emissão de CT-e",
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
    <html lang="en">
      <body className={cn(
        "min-h-screen bg-background font-sans antialiased",
        fontSans.variable
      )}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
