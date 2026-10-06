// Root layout: global fonts, page metadata, and the persistent editorial header.
import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Rubik } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

// Rubik, the display voice, self-hosted at build time by `next/font`. 800 is the hero's alone, 700
// every other display element, 600 the nav. The hero's ink-width divisors in `globals.css` are
// measured against 800.
const rubik = Rubik({
  weight: ["600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-rubik",
});

// IBM Plex Mono: the body / UI voice, a developer's typeface for copy, labels, and meta.
const plexMono = IBM_Plex_Mono({
  // 600 is only the contact floor's sign-off, which has to hold its own on the pixels.
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-plex",
});

// IBM Plex Sans: sentences you read (About, Services and Works descriptions). Same x-height and stroke
// as Plex Mono, so it drops in without moving a size or weight; only the line gets longer.
const plexSans = IBM_Plex_Sans({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-plex-sans",
});

// The link preview, favicon and apple icon are file conventions beside this file. The preview is a
// hero SCREENSHOT (the canvases cannot render in `next/og`), so retake it when the hero changes.
// `metadataBase` makes the preview URL absolute; without it chat clients show nothing.
export const metadata: Metadata = {
  metadataBase: new URL("https://jeremy.ee"),
  title: "Jeremy Vaask | Fullstack Developer",
  description: "Portfolio: fullstack development and design, end to end.",
  openGraph: {
    title: "Jeremy Vaask | Fullstack Developer",
    description: "Portfolio: fullstack development and design, end to end.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${rubik.variable} ${plexMono.variable} ${plexSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Header />
        {children}
      </body>
    </html>
  );
}
