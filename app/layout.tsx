import type { Metadata } from "next";
import Link from "next/link";
import { Archivo, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";

import "./globals.css";
import Mark from "@/components/Mark";
import SampleBanner from "@/components/SampleBanner";
import ConnectButton from "@/components/ConnectButton";
import ThemeToggle from "@/components/ThemeToggle";
import { ORIGIN } from "@/lib/chain";

/* Self hosted rather than linked from a font CDN. A page whose whole claim is
 * that it does not depend on one server should not need a request to Google to
 * finish rendering, and the file is emitted with the build so the type never
 * arrives after the layout has settled. */
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-archivo",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(ORIGIN),
  title: {
    default: "Standing — web evidence, agreed by strangers",
    template: "%s — Standing",
  },
  description:
    "Paste a url. Independent validators fetch it, agree on what it claims, and record a certificate with a screenshot digest and a timestamp.",
  openGraph: {
    siteName: "Standing",
    type: "website",
  },
};

/* Runs before first paint, so the page is never painted in the wrong theme and
 * then corrected. A stored choice always wins; without one the operating
 * system's preference is honoured. Kept to one statement and wrapped in a
 * try, because a throw here would block rendering entirely. */
const THEME_SCRIPT = `try{var s=localStorage.getItem('standing-theme');var d=s?s==='dark':matchMedia('(prefers-color-scheme:dark)').matches;document.documentElement.setAttribute('data-theme',d?'dark':'light')}catch(e){document.documentElement.setAttribute('data-theme','light')}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${archivo.variable} ${plexMono.variable} ${instrument.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <div className="site">
          <SampleBanner />

          <header
            style={{
              position: "sticky",
              top: 0,
              zIndex: 20,
              background: "var(--bg)",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <div
              className="shell pad"
              style={{
                height: 64,
                display: "flex",
                alignItems: "center",
                gap: 40,
              }}
            >
              <Link
                href="/"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  color: "var(--ink)",
                }}
              >
                <Mark size={26} />
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 16,
                    fontWeight: 600,
                    letterSpacing: "-0.02em",
                  }}
                >
                  standing
                </span>
              </Link>

              <nav
                style={{
                  display: "flex",
                  gap: 26,
                  fontSize: 14,
                  color: "var(--muted)",
                }}
              >
                <Link href="/verify" style={{ color: "inherit" }}>
                  Verify
                </Link>
                <Link href="/watch" style={{ color: "inherit" }}>
                  Watch
                </Link>
                <Link href="/api" style={{ color: "inherit" }}>
                  API
                </Link>
              </nav>

              <div className="spacer" />

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ThemeToggle />
                <ConnectButton />
              </div>
            </div>
          </header>

          <main className="shell">{children}</main>

          <footer
            className="slab"
            style={{ borderTop: "1px solid var(--line)" }}
          >
            <div
              className="pad"
              style={{
                maxWidth: "var(--shell)",
                margin: "0 auto",
                paddingTop: 64,
                paddingBottom: 40,
              }}
            >
              {/* The limit of the product, in the largest type the footer has.
                  It is the sentence most likely to be screenshotted alongside a
                  certificate, so it is not a small grey line at the bottom. */}
              <p
                className="serif"
                style={{
                  maxWidth: 860,
                  fontSize: "clamp(24px, 3vw, 38px)",
                  lineHeight: 1.2,
                  textWrap: "pretty",
                }}
              >
                A certificate proves several independent validators saw these
                claims at this time. It does not prove the claims are true, and
                it never will.
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
                <Link href="/verify">Verify</Link>
                <Link href="/watch">Watch</Link>
                <Link href="/api">API</Link>
                <a
                  href="https://genlayer.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GenLayer
                </a>
                <div className="spacer" />
                <span>
                  GenLayer Testnet Bradbury · fee 0.4 GEN · threshold 6000 bps
                </span>
              </div>

              <div
                style={{
                  marginTop: 26,
                  paddingTop: 22,
                  borderTop: "1px solid var(--slab-line)",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
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
                  Run by InferNode, built on GenLayer
                </span>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
