/**
 * The image check on a certificate: did the rendered page show what its text
 * stated?
 *
 * Every validator renders its own screenshot, asks its own model, and the
 * answers are compared exactly, so this band reports a finding the network
 * agreed on. It gets a band and a sentence rather than an icon in a corner.
 */
export default function CloakingNotice({ cloaking }: { cloaking: boolean }) {
  if (!cloaking) {
    return (
      <section className="verdict verdict-ok">
        <span className="verdict-glyph" style={{ color: "var(--accent)" }} aria-hidden="true">
          =
        </span>
        <div>
          <p className="eyebrow" style={{ color: "var(--accent)", marginBottom: 6 }}>
            Image check
          </p>
          <p>
            Each validator compared its own screenshot of this page with the text it was
            served, and they agreed the two show the same claims.
          </p>
        </div>
      </section>
    );
  }
  return (
    <section className="verdict verdict-flag">
      <span className="verdict-glyph" style={{ color: "var(--flag)" }} aria-hidden="true">
        !
      </span>
      <div>
        <p className="eyebrow" style={{ color: "var(--flag)", marginBottom: 6 }}>
          Cloaking
        </p>
        <p>
          Each validator compared its own screenshot of this page with the text it was
          served, and they agreed the two show different claims. A page that serves a
          script something other than what it shows a reader looks like this, and so does
          a page that changed while it was being read.
        </p>
      </div>
    </section>
  );
}
