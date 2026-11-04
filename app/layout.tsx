import type { Metadata, Viewport } from "next";
import { preconnect } from "react-dom";
import { Geist, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { I18nProvider } from "@/components/i18n-provider";
import { ServiceWorkerRegister } from "@/components/service-worker";
import { getI18n } from "@/lib/i18n/server";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const grotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: t("dash.metaTitle"),
    description: t("dash.metaDescription"),
    robots: { index: false, follow: false },
    applicationName: "PocketLedger",
    appleWebApp: { capable: true, title: "PocketLedger", statusBarStyle: "black-translucent" },
    icons: {
      icon: [
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        { url: "/icon.svg", type: "image/svg+xml" },
      ],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0f131d",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale } = await getI18n();
  preconnect("https://raw.githubusercontent.com");

  return (
    <html
      lang={locale}
      className={`${geist.variable} ${grotesk.variable} ${mono.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla's cz-shortcut-listen) inject attributes onto <body> before hydration. */}
      <body className="min-h-full" suppressHydrationWarning>
        <I18nProvider locale={locale}>{children}</I18nProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
