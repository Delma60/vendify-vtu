import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";

const geist = Inter({ subsets: ["latin"], variable: "--font-sans" });

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
      <body>{children}
        <Toaster
          position="top-right" 
          toastOptions={{
            duration: 5000,
            classNames: {
              toast: 'bg-white border-gray-200 shadow-lg rounded-xl',
              title: 'text-gray-900 font-semibold',
              description: 'text-gray-500',
              success: 'text-green-600',
              error: 'text-red-600',
              warning: 'text-yellow-600',
              info: 'text-blue-600',
            },
          }}
        />
      </body>
    </html>
  );
}
