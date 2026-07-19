"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { Github, Linkedin, Mail, ExternalLink } from "lucide-react";

const year = new Date().getFullYear();

const PRODUCT_LINKS = [
  { label: "Home", href: "/" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Contact", href: "/contact" },
];

const COMMUNITY_LINKS = [
  { label: "Discussions", href: "https://github.com/Priyanshu-byte-coder/devtrack/discussions" },
  { label: "Issues", href: "https://github.com/Priyanshu-byte-coder/devtrack/issues" },
  { label: "GitHub Repository", href: "https://github.com/Priyanshu-byte-coder/devtrack" },
  { label: "Contributing Guide", href: "https://github.com/Priyanshu-byte-coder/devtrack/blob/main/CONTRIBUTING.md" },
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
    "group relative w-fit text-[14px] text-[var(--muted-foreground)] transition-colors duration-200 hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 rounded-sm text-left";

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

  if (pathname === "/wrapped") return null;

  return (
    <footer
      className={`mt-auto border-t relative overflow-hidden ${isLanding
        ? "bg-transparent border-slate-900/40"
        : "border-[var(--border)] bg-[var(--background)]"
        }`}
      aria-label="Site footer"
    >
      {/* Top gradient accent */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(129,140,248,0.06),transparent_60%)] pointer-events-none" />

      {/* Large faded branding text */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 select-none text-[clamp(4rem,12vw,10rem)] font-black uppercase tracking-tighter text-[var(--foreground)] opacity-[0.025] whitespace-nowrap"
        style={{ fontFamily: "var(--font-syne, system-ui, sans-serif)" }}
      >
        DEVTRACK
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-6 py-12 sm:px-8 lg:px-12">

        {/* Main grid */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.8fr_1fr_1fr_1fr_1fr]">

          {/* Brand column */}
          <div>
            <div className="inline-flex items-center rounded-full border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
              Open source developer dashboard
            </div>
            <h2
              className="mt-5 text-2xl font-extrabold text-[var(--foreground)] sm:text-3xl"
              style={{
                fontFamily: "var(--font-syne, system-ui, sans-serif)",
                letterSpacing: "-0.03em",
              }}
            >
              DevTrack keeps your
              <br />
              coding story in one place.
            </h2>
            <p
              className="mt-4 max-w-sm text-[14px] leading-relaxed text-[var(--muted-foreground)]"
              style={{ fontFamily: "var(--font-jetbrains, ui-monospace, monospace)" }}
            >
              Track GitHub contributions, PR velocity, streaks, goals, and
              community activity — built for contributors who work in public.
            </p>

            {/* Social icons */}
            <div className="mt-6 flex items-center gap-3">
              {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] transition-all duration-200 hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Product links */}
          <div>
            <h3
              className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--foreground)]"
              style={{ fontFamily: "var(--font-jetbrains, ui-monospace, monospace)" }}
            >
              Product
            </h3>
            <nav aria-label="Product links" className="mt-6 flex flex-col gap-3">
              {PRODUCT_LINKS.map(({ label, href }) => {
                if (label === "Dashboard" && !isAuthenticated) {
                  return (
                    <FooterLink
                      key={label}
                      onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
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

          {/* Community links */}
          <div>
            <h3
              className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--foreground)]"
              style={{ fontFamily: "var(--font-jetbrains, ui-monospace, monospace)" }}
            >
              Community
            </h3>
            <nav aria-label="Community links" className="mt-6 flex flex-col gap-3">
              {COMMUNITY_LINKS.map(({ label, href }) => (
                <FooterLink key={label} href={href} external>
                  {label}
                </FooterLink>
              ))}
            </nav>
          </div>

          <div>
            <h3
              className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--foreground)]"
              style={{
                fontFamily: "var(--font-jetbrains, ui-monospace, monospace)",
              }}
            >
              Legal Links
            </h3>

            <nav
              aria-label="Legal links"
              className="mt-6 flex flex-col gap-3"
            >
              {LEGAL_LINKS.map(({ label, href }) => (
                <FooterLink key={label} href={href}>
                  {label}
                </FooterLink>
              ))}
            </nav>
          </div>
          {/* Stats column */}
          <div>
            <h3
              className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--foreground)]"
              style={{ fontFamily: "var(--font-jetbrains, ui-monospace, monospace)" }}
            >
              Built with
            </h3>
            <div className="mt-6 flex flex-col gap-3">
              {[
                "Next.js 14",
                "Tailwind CSS",
                "Supabase",
                "TypeScript",
                "Vercel",
              ].map((tech) => (
                <span
                  key={tech}
                  className="w-fit text-[14px] text-[var(--muted-foreground)]"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-12 h-px w-full bg-gradient-to-r from-transparent via-[var(--border)] to-transparent" />

        {/* Bottom bar */}
        <div
          className="mt-6 flex flex-col gap-3 text-[12px] text-[var(--muted-foreground)] sm:flex-row sm:items-center sm:justify-between"
          style={{ fontFamily: "var(--font-jetbrains, ui-monospace, monospace)" }}
        >
          <p>© {year} DevTrack. Built for open-source contributors.</p>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
              All systems operational
            </span>
            <span>MIT License</span>
            <span>Self-hostable & Privacy-conscious</span>
          </div>
        </div>
      </div>
    </footer>
  );
}