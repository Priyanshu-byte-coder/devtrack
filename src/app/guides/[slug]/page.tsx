import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GUIDES, findGuide } from "@/content/guides";
import {
  JsonLd,
  SITE_NAME,
  SITE_URL,
  breadcrumbJsonLd,
} from "@/lib/seo/json-ld";

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = findGuide(slug);
  if (!guide) return { title: "Guides" };
  const path = `/guides/${guide.slug}`;
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      title: guide.title,
      description: guide.description,
      url: path,
      publishedTime: guide.published,
      modifiedTime: guide.updated,
    },
  };
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = findGuide(slug);
  if (!guide) notFound();

  const path = `/guides/${guide.slug}`;
  const others = GUIDES.filter((g) => g.slug !== guide.slug);

  return (
    <article className="mx-auto max-w-3xl pb-12">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "TechArticle",
            headline: guide.title,
            description: guide.description,
            datePublished: guide.published,
            dateModified: guide.updated,
            url: `${SITE_URL}${path}`,
            mainEntityOfPage: `${SITE_URL}${path}`,
            author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
            publisher: { "@id": `${SITE_URL}/#organization` },
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: guide.faq.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          },
          breadcrumbJsonLd([
            { name: "DevTrack", path: "/" },
            { name: "Guides", path: "/guides" },
            { name: guide.title, path },
          ]),
        ]}
      />

      <nav
        aria-label="Breadcrumb"
        className="font-pixel text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]"
      >
        <Link href="/guides" className="hover:text-[var(--accent)]">
          Guides
        </Link>
      </nav>
      <h1 className="mt-3 font-pixel text-[clamp(1.6rem,4vw,2.5rem)] uppercase leading-tight text-[var(--foreground)]">
        {guide.title}
      </h1>
      <p className="mt-3 text-sm text-[var(--muted-foreground)]">
        Updated{" "}
        <time dateTime={guide.updated}>
          {dateFmt.format(new Date(guide.updated))}
        </time>
      </p>

      <div className="mt-8 text-[15px] leading-7 text-[var(--foreground)] [&_code]:bg-[var(--control)] [&_code]:px-1 [&_code]:font-mono [&_code]:text-[13px] [&_h2]:mt-10 [&_h2]:font-pixel [&_h2]:text-sm [&_h2]:uppercase [&_h2]:tracking-[0.12em] [&_h2]:text-[var(--accent)] [&_li]:mt-1.5 [&_p]:mt-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6">
        {guide.body()}
      </div>

      <section
        aria-labelledby="faq-heading"
        className="px-frame mt-12 bg-[var(--card)] p-6"
      >
        <h2
          id="faq-heading"
          className="font-pixel text-sm uppercase tracking-[0.12em] text-[var(--card-foreground)]"
        >
          Quick answers
        </h2>
        <dl className="mt-4 space-y-4">
          {guide.faq.map((item) => (
            <div key={item.q}>
              <dt className="font-semibold text-[var(--card-foreground)]">
                {item.q}
              </dt>
              <dd className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="more-guides" className="mt-12">
        <h2
          id="more-guides"
          className="font-pixel text-sm uppercase tracking-[0.14em] text-[var(--muted-foreground)]"
        >
          More guides
        </h2>
        <ul className="mt-4 space-y-2">
          {others.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/guides/${g.slug}`}
                className="text-[var(--accent)] hover:underline"
              >
                {g.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
