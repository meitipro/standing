import type { Metadata } from "next";
import Link from "next/link";
import { Archivo, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";

import "./globals.css";
import Mark from "@/components/Mark";
import ConnectButton from "@/components/ConnectButton";
import ThemeToggle from "@/components/ThemeToggle";
import { CHAIN, EXPLORER, IS_LIVE, ORIGIN, STANDING } from "@/lib/chain";
import { shortAddress } from "@/lib/format";

/* Self hosted by next/font rather than linked from a font CDN, so the type is
 * emitted with the build and never arrives after the layout has settled. */
const archivo = Archivo({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-archivo", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono", display: "swap" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-instrument", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(ORIGIN),
  title: { default: "Standing - web evidence, agreed by strangers", template: "%s - Standing" },
  description:
    "Paste a url. Every validator reads the page for itself and checks each claim against its own copy, and the claims they all found are recorded with the moment they were read.",
  openGraph: { siteName: "Standing", type: "website" },
};

/* Runs before first paint, so the page is never painted in the wrong theme and
 * then corrected. A stored choice wins; without one the system's preference
 * does. Wrapped in a try, because a throw here would block rendering. */
const THEME_SCRIPT = `try{var s=localStorage.getItem('standing-theme');var d=s?s==='dark':matchMedia('(prefers-color-scheme:dark)').matches;document.documentElement.setAttribute('data-theme',d?'dark':'light')}catch(e){document.documentElement.setAttribute('data-theme','light')}`;

const NAV = [
  { href: "/bulk", label: "Bulk" },
  { href: "/verify", label: "Verify" },
  { href: "/watch", label: "Watch" },
  { href: "/api", label: "API" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${archivo.variable} ${plexMono.variable} ${instrument.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <div className="site">
          <header style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--bg)", borderBottom: "1px solid var(--line)" }}>
            <div className="shell pad masthead">
              <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink)" }}>
                <Mark size={26} />
                <span style={{ fontFamily: "var(--mono)", fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>standing</span>
              </Link>

              <nav className="masthead-nav">
                {NAV.map((item) => (
                  <Link key={item.href} href={item.href} style={{ color: "inherit" }}>
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="spacer" />

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ThemeToggle />
                <ConnectButton />
              </div>
            </div>
          </header>

          <main className="shell">{children}</main>

          <footer className="slab" style={{ borderTop: "1px solid var(--line)" }}>
            <div className="pad" style={{ maxWidth: "var(--shell)", margin: "0 auto", paddingTop: 64, paddingBottom: 40 }}>
              <p className="serif" style={{ maxWidth: 860, fontSize: "clamp(24px, 3vw, 38px)", lineHeight: 1.2, textWrap: "pretty" }}>
                A certificate records what a page stated at one moment, each claim confirmed by
                validators who read the page for themselves.
              </p>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "28px 48px",
                  marginTop: 52,
                  paddingTop: 24,
                  borderTop: "1px solid var(--slab-line)",
                  fontFamily: "var(--mono)",
                  fontSize: 12,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--slab-muted)",
                }}
              >
                {NAV.map((item) => (
                  <Link key={item.href} href={item.href}>
                    {item.label}
                  </Link>
                ))}
                <a href="/api/contract-source">Contract source</a>
                <a href="https://genlayer.com" target="_blank" rel="noopener noreferrer">
                  GenLayer
                </a>
                <div className="spacer" />
                <span>
                  {CHAIN.name}
                  {IS_LIVE && (
                    <>
                      {" - "}
                      <a href={`${EXPLORER}/address/${STANDING}`} target="_blank" rel="noopener noreferrer">
                        contract {shortAddress(STANDING)}
                      </a>
                    </>
                  )}
                </span>
              </div>

              <div style={{ marginTop: 26, paddingTop: 22, borderTop: "1px solid var(--slab-line)", display: "flex", justifyContent: "center" }}>
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 12,
                    letterSpacing: "0.24em",
                    textTransform: "uppercase",
                    color: "var(--slab-muted)",
                    textAlign: "center",
                  }}
                >
                  Built by InferNode, on GenLayer
                </span>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
