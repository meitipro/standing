"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The masthead links. The current section is marked with aria-current, which
 * a screen reader announces and the stylesheet underlines, so nobody has to
 * infer where they are from the page title alone.
 */
export default function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname() ?? "/";
  return (
    <nav className="masthead-nav" aria-label="Main">
      {items.map((item) => {
        const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} aria-current={current ? "page" : undefined}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
