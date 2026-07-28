"use client";

import { useEffect, useState } from "react";

/**
 * Light and dark, remembered.
 *
 * The attribute is set on <html> by an inline script in the document head
 * before first paint, so this component's only job after mounting is to read
 * back what that script decided and to flip it on click. It renders the label
 * as a fixed-width placeholder until then: guessing the theme during server
 * render would either flash the wrong word or, worse, disagree with the
 * markup React hydrated and get the whole subtree thrown away.
 */
const KEY = "standing-theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const now = document.documentElement.getAttribute("data-theme");
    setTheme(now === "dark" ? "dark" : "light");
  }, []);

  function flip() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private browsing refuses writes. The theme still applies for this
      // page view, it just will not be remembered, which is not worth a
      // dialog.
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      className="btn"
      onClick={flip}
      aria-label={
        theme ? `Switch to ${theme === "dark" ? "light" : "dark"} theme` : "Switch theme"
      }
      style={{ minWidth: 62 }}
    >
      {theme === null ? "" : theme === "dark" ? "light" : "dark"}
    </button>
  );
}
