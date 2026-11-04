import Script from "next/script";

/** Microsoft Clarity project for devtrack.live. Public: it ships to every visitor. */
const CLARITY_PROJECT_ID = "z873vus4yx";

/**
 * Microsoft Clarity (heatmaps and session replays) for the production site.
 *
 * Loads once the page is idle, so it stays off the critical path. The inline
 * guard means previews, forks deployed to their own Vercel production and
 * local builds never report into this project. Clarity masks form inputs by
 * default; the signed-in dashboard is masked entirely (`data-clarity-mask`
 * in AppShell) because it shows private repository names.
 */
export default function ClarityScript({ nonce }: { nonce?: string }) {
  if (process.env.VERCEL_ENV !== "production") return null;
  return (
    // Not id="clarity": an element id becomes window.clarity, which the
    // snippet would mistake for its own queue.
    <Script id="ms-clarity-tag" strategy="lazyOnload" nonce={nonce}>
      {`(function(c,l,a,r,i,t,y){
  if (l.location.hostname !== "devtrack.live") return;
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");`}
    </Script>
  );
}
