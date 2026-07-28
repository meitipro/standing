/**
 * The verdict band on a certificate: did the picture show what the text said?
 *
 * One full sentence explaining what the answer means, for readers who have
 * never heard the term. It is the most valuable line the product can produce —
 * no screenshot tool can tell you this — so it gets a band of its own and
 * prose, rather than a red icon in a corner.
 */
export default function CloakingNotice({ cloaking }: { cloaking: boolean }) {
  if (!cloaking) {
    return (
      <section className="verdict verdict-ok">
        <span
          className="verdict-glyph"
          style={{ color: "var(--accent)" }}
          aria-hidden="true"
        >
          =
        </span>
        <div>
          <p
            className="eyebrow"
            style={{ color: "var(--accent)", marginBottom: 6 }}
          >
            Cloaking
          </p>
          <p>
            The rendered screenshot matches the text this page served to the
            validators — a reader and a script were shown the same thing at this
            moment.
          </p>
        </div>
      </section>
    );
  }
  return (
    <section className="verdict verdict-flag">
      <span
        className="verdict-glyph"
        style={{ color: "var(--flag)" }}
        aria-hidden="true"
      >
        !
      </span>
      <div>
        <p className="eyebrow" style={{ color: "var(--flag)", marginBottom: 6 }}>
          Cloaking
        </p>
        <p>
          The rendered screenshot does not match the text this page served to
          the validators — a reader and a script were shown different things at
          this moment. That usually means the page treats a crawler differently,
          but it can also mean the page changed while it was being read. It is a
          fact about the capture, not an accusation.
        </p>
      </div>
    </section>
  );
}
