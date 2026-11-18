import type { Metadata, Viewport } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const body = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RentFleet — Ενοικίαση οχημάτων με ΑΑΔΕ",
  description:
    "Desk ops, online booking, Stripe, Ψηφιακό Πελατολόγιο & myDATA για rent-a-car στην Ελλάδα.",
  applicationName: "RentFleet",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1b6ca8",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="el" className={`${display.variable} ${body.variable} h-full`}>
      <body className="min-h-full w-full overflow-x-clip antialiased">
        {children}
      </body>
    </html>
  );
}
