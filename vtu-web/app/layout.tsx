import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VTU Platform",
  description: "A VTU platform built with Next.js and Firebase.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
