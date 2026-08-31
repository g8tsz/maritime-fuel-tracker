import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maritime Bunker Platform",
  description: "Custody-transfer aware bunker station operations, billing, and metering integration.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
