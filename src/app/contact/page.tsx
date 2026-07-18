import type { Metadata } from "next";
import Link from "next/link";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact | DevTrack",
  description: "Send feedback, questions, or support requests to the DevTrack team.",
};

export default function ContactPage() {
  return (
    <main className="relative overflow-hidden bg-[#0f172a] px-4 py-12 text-[#e5eefc] sm:px-6 lg:px-8 lg:py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.08),transparent_30%),radial-gradient(circle_at_top_right,rgba(2,6,23,0.35),transparent_28%)]" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
        <section className="lg:max-w-xl lg:pt-6">
          <p className="inline-flex rounded-full border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[var(--accent)]">
            Contact DevTrack
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-[#f8fafc] sm:text-5xl">
            Reach out with feedback, questions, or support needs.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#94a3b8] sm:text-lg">
            Use this form for product feedback, bug reports, or anything else you want to share with the DevTrack team.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#111b2f]/95 p-5 shadow-[0_18px_35px_-24px_rgba(2,6,23,0.85)]">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#f8fafc]">
                Response focus
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#94a3b8]">
                Messages are reviewed with product and support in mind, so you can keep everything in one place.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#111b2f]/95 p-5 shadow-[0_18px_35px_-24px_rgba(2,6,23,0.85)]">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#f8fafc]">
                Prefer an issue?
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#94a3b8]">
                You can also open an issue on GitHub if the request is better suited to public tracking.
              </p>
              <Link
                href="https://github.com/Priyanshu-byte-coder/devtrack/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex text-sm font-medium text-[#60a5fa] transition-colors hover:text-[#dbeafe]"
              >
                View GitHub issues
              </Link>
            </div>
          </div>
        </section>

        <div className="w-full lg:max-w-xl">
          <ContactForm />
        </div>
      </div>
    </main>
  );
}
