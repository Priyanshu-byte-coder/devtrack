"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { Github, Linkedin, Mail, ExternalLink } from "lucide-react";

const year = new Date().getFullYear();

const PRODUCT_LINKS = [
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Compare developers", href: "/compare" },
  { label: "Year in Code", href: "/wrapped" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Contact", href: "/contact" },
];

const COMMUNITY_LINKS = [
  {
    label: "Discussions",
    href: "https://github.com/Priyanshu-byte-coder/devtrack/discussions",
  },
  {
    label: "Issues",
    href: "https://github.com/Priyanshu-byte-coder/devtrack/issues",
  },
  {
    label: "GitHub Repository",
    href: "https://github.com/Priyanshu-byte-coder/devtrack",
  },
  { label: "Sponsor DevTrack", href: "/sponsor" },
  {
    label: "Contributing Guide",
    href: "https://github.com/Priyanshu-byte-coder/devtrack/blob/main/CONTRIBUTING.md",
  },
];

const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Guidelines", href: "/guidelines" },
  { label: "Documentation", href: "/api-docs" },
];

const SOCIAL_LINKS = [
  {
    label: "GitHub",
    href: "https://github.com/Priyanshu-byte-coder",
    icon: Github,
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/priyanshu-doshi-21a54230a/",
    icon: Linkedin,
  },
  {
    label: "Email",
    href: "mailto:doshipriyanshu3@gmail.com",
    icon: Mail,
  },
  {
    label: "Portfolio",
    href: "https://portfolio-eta-gilt-84.vercel.app/",
    icon: ExternalLink,
  },
];

function FooterLink({
  href,
  children,
  external = false,
  onClick,
}: {
  href?: string;
  children: React.ReactNode;
  external?: boolean;
  onClick?: () => void;
}) {
  const baseClass =
    "group relative w-fit text-[14px] text-[var(--muted-foreground)] transition-colors duration-200 hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 text-left";

  const underline = (
    <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[var(--accent)] transition-all duration-300 group-hover:w-full" />
  );

  if (onClick) {
    return (
      <button onClick={onClick} className={baseClass}>
        {children}
        {underline}
      </button>
    );
  }

  if (external && href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={baseClass}
      >
        {children}
        {underline}
      </a>
    );
  }

  return (
    <Link href={href || "#"} className={baseClass}>
      {children}
      {underline}
    </Link>
  );
}

export default function Footer() {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  if (pathname === "/wrapped" || pathname.startsWith("/dashboard")) return null;

  const heading =
    "font-pixel text-[11px] uppercase tracking-[0.16em] text-[var(--foreground)]";

  return (
    <footer
      className={`site-footer relative mt-auto overflow-hidden border-t-4 ${
        isLanding
          ? "border-[var(--border)] bg-transparent"
          : "border-[var(--border)] bg-[var(--background)]"
      }`}
      aria-label="Site footer"
    >
      {/* Large faded pixel branding */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 select-none whitespace-nowrap font-pixel text-[clamp(4rem,12vw,10rem)] uppercase leading-none text-[var(--foreground)] opacity-[0.03]"
      >
        DEVTRACK
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-6 py-12 sm:px-8 lg:px-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.8fr_1fr_1fr_1fr]">
          {/* Brand column */}
          <div>
            <p className="font-pixel text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
              Open source · MIT licensed
            </p>
            <h2 className="mt-4 font-pixel text-2xl uppercase leading-tight text-[var(--foreground)] sm:text-3xl">
              Your code has
              <br />a high score.
            </h2>
            <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-[var(--muted-foreground)]">
              Streaks, XP, tiers and a global leaderboard, built from the GitHub
              activity you already have.
            </p>

            {/* Social icons */}
            <div className="mt-6 flex items-center gap-2">
              {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center border-2 border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] transition-colors duration-200 hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className={heading}>Play</h3>
            <nav
              aria-label="Product links"
              className="mt-6 flex flex-col gap-3"
            >
              {PRODUCT_LINKS.map(({ label, href }) => {
                if (label === "Dashboard" && !isAuthenticated) {
                  return (
                    <FooterLink
                      key={label}
                      onClick={() =>
                        signIn("github", { callbackUrl: "/dashboard" })
                      }
                    >
                      {label}
                    </FooterLink>
                  );
                }
                return (
                  <FooterLink key={label} href={href}>
                    {label}
                  </FooterLink>
                );
              })}
            </nav>
          </div>

          <div>
            <h3 className={heading}>Community</h3>
            <nav
              aria-label="Community links"
              className="mt-6 flex flex-col gap-3"
            >
              {COMMUNITY_LINKS.map(({ label, href }) => (
                <FooterLink
                  key={label}
                  href={href}
                  external={href.startsWith("http")}
                >
                  {label}
                </FooterLink>
              ))}
            </nav>
          </div>

          <div>
            <h3 className={heading}>Legal</h3>
            <nav aria-label="Legal links" className="mt-6 flex flex-col gap-3">
              {LEGAL_LINKS.map(({ label, href }) => (
                <FooterLink key={label} href={href}>
                  {label}
                </FooterLink>
              ))}
            </nav>
          </div>
        </div>

        <div className="mt-12 border-t-4 border-dotted border-[var(--border)]" />

        <div className="mt-6 flex flex-col gap-3 font-mono text-[12px] text-[var(--muted-foreground)] sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} DevTrack. Built for open-source contributors.</p>
          <p>MIT License · Self-hostable</p>
        </div>
      </div>
    </footer>
  );
}
