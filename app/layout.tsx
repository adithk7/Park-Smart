import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ParkSmart // Mobility Intelligence & Venue Operations Engine",
  description: "Every arrival. Every space. Under control. Real-time spatial telemetry, computer vision ANPR, and automated blocked-car relay.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="bg-[#0B0E13] text-[#F4F4F5] min-h-screen flex flex-col selection:bg-[#F05A28] selection:text-white">
        {children}
      </body>
    </html>
  );
}
