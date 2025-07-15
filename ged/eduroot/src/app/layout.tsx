import type { Metadata } from "next";
import { Geist, Geist_Mono, Oxanium, Source_Code_Pro } from "next/font/google";
import "./globals.css";
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { ThemeInitializer } from '@/components/providers/theme-initializer';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const oxanium = Oxanium({
  variable: "--font-sans",
  subsets: ["latin"],
});

const sourceCodePro = Source_Code_Pro({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EduRoot - AI-Powered Learning Platform",
  description: "Global, AI-guided, self-paced education system for GED and K-12 students",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style id="initial-theme" dangerouslySetInnerHTML={{
          __html: `
            :root {
              --background: oklch(0.8452 0 0);
              --foreground: oklch(0.2393 0 0);
              --card: oklch(0.7572 0 0);
              --card-foreground: oklch(0.2393 0 0);
              --popover: oklch(0.7572 0 0);
              --popover-foreground: oklch(0.2393 0 0);
              --primary: oklch(0.5016 0.1887 27.4816);
              --primary-foreground: oklch(1.0000 0 0);
              --secondary: oklch(0.4955 0.0896 126.1858);
              --secondary-foreground: oklch(1.0000 0 0);
              --muted: oklch(0.7826 0 0);
              --muted-foreground: oklch(0.4091 0 0);
              --accent: oklch(0.5880 0.0993 245.7394);
              --accent-foreground: oklch(1.0000 0 0);
              --destructive: oklch(0.7076 0.1975 46.4558);
              --destructive-foreground: oklch(0 0 0);
              --border: oklch(0.4313 0 0);
              --input: oklch(0.4313 0 0);
              --ring: oklch(0.5016 0.1887 27.4816);
              --chart-1: oklch(0.5016 0.1887 27.4816);
              --chart-2: oklch(0.4955 0.0896 126.1858);
              --chart-3: oklch(0.5880 0.0993 245.7394);
              --chart-4: oklch(0.7076 0.1975 46.4558);
              --chart-5: oklch(0.5656 0.0431 40.4319);
            }
            .dark {
              --background: oklch(0.2178 0 0);
              --foreground: oklch(0.9067 0 0);
              --card: oklch(0.2850 0 0);
              --card-foreground: oklch(0.9067 0 0);
              --popover: oklch(0.2850 0 0);
              --popover-foreground: oklch(0.9067 0 0);
              --primary: oklch(0.6083 0.2090 27.0276);
              --primary-foreground: oklch(1.0000 0 0);
              --secondary: oklch(0.6423 0.1467 133.0145);
              --secondary-foreground: oklch(0 0 0);
              --muted: oklch(0.2645 0 0);
              --muted-foreground: oklch(0.7058 0 0);
              --accent: oklch(0.7482 0.1235 244.7492);
              --accent-foreground: oklch(0 0 0);
              --destructive: oklch(0.7839 0.1719 68.0943);
              --destructive-foreground: oklch(0 0 0);
              --border: oklch(0.4091 0 0);
              --input: oklch(0.4091 0 0);
              --ring: oklch(0.6083 0.2090 27.0276);
              --chart-1: oklch(0.6083 0.2090 27.0276);
              --chart-2: oklch(0.6423 0.1467 133.0145);
              --chart-3: oklch(0.7482 0.1235 244.7492);
              --chart-4: oklch(0.7839 0.1719 68.0943);
              --chart-5: oklch(0.6471 0.0334 40.7963);
            }
          `
        }} />
      </head>
      <body
        className={`${oxanium.variable} ${sourceCodePro.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <ThemeInitializer />
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
