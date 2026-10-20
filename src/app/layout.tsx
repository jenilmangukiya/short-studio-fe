import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "@/lib/query-client";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Shorts Studio",
  description: "Automated short video pipeline studio",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans">
        <Providers>
          <Suspense fallback={<div className="h-16 border-b border-slate-200 bg-white" />}>
            <Navbar />
          </Suspense>
          <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 flex flex-col">
            <Suspense
              fallback={
                <div className="flex flex-1 items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
                </div>
              }
            >
              {children}
            </Suspense>
          </main>
        </Providers>
      </body>
    </html>
  );
}
