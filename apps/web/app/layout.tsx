import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vista Meet",
  description: "3D Meeting Platform powered by Matterport",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
