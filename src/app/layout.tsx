import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import AppShell from "@/components/layout/AppShell";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Khazana Mithai POS",
  description: "Point of Sale System for Khazana Mithai",
  // Next's app-router conventions pick these up from src/app automatically:
  //   icon.png        -> browser tab favicon
  //   apple-icon.png  -> iOS home-screen icon
  // Declaring them here as well keeps the tags stable if a file is renamed.
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/apple-icon.png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* AppShell lives in the root layout so the sidebar mounts ONCE and
            persists across navigation (no remount / menu refetch / flash). */}
        <AppShell>{children}</AppShell>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      </body>
    </html>
  );
}
