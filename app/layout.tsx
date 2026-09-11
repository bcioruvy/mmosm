import "./globals.css";
import type { Viewport } from "next";

export const metadata = {
  title: "mmosm Accounting",
};

export const viewport: Viewport = {
  themeColor: "#38040e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
