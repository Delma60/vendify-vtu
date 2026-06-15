import "./globals.css";
import type { Metadata } from "next";
import { Geist, Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Inter({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body>{children}</body>
    </html>
  );
}
