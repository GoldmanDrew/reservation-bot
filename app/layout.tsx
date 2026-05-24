import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reservation Bot",
  description: "Snipe restaurant reservations on Resy and OpenTable",
};

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-2 text-sm text-gray-400 transition-colors hover:bg-surface-border hover:text-white"
    >
      {children}
    </Link>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-surface-border bg-surface-raised/80 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20 text-lg">
                  🎯
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-white">
                    Reservation Bot
                  </h1>
                  <p className="text-xs text-gray-500">
                    Snipe Resy & OpenTable drops
                  </p>
                </div>
              </div>
              <nav className="flex items-center gap-1">
                <NavLink href="/">New Snipe</NavLink>
                <NavLink href="/jobs">Jobs</NavLink>
                <NavLink href="/settings">Settings</NavLink>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
