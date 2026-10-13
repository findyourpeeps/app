import type { Metadata } from "next";
import { Raleway, Roboto_Mono } from "next/font/google";
import "./globals.css";

const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin"],
  weight: ["500", "700", "900"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  title: "Find Your Peeps",
  description: "Good company. Great possibilities.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${raleway.variable} ${robotoMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans text-ink">
        {children}
      </body>
    </html>
  );
}
