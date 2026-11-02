# Production dependency advisories

Snapshot: pnpm audit --prod --json on 2026-10-11, current lockfile at `a20e51d437a220db4e626a072a9716b67381eca9`. Source: [raw audit](evidence/dependency-audit-network-enabled.json). No package or lockfile changes were made.

**35 advisory entries, 29 unique GHSA IDs: 1 critical, 17 high, 14 moderate, 3 low.** Several IDs recur across installed brace-expansion majors. Severity is advisory metadata, not proof that each vulnerable code path is reachable in DevTrack. Some development-tool dependencies appear through production package trees.

The critical [Next ImageResponse advisory](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) concerns the Node runtime handling attacker-controlled SVG attributes/styles/content. DevTrack has a Node public-profile OG image and two Edge API image routes; the specific vulnerable path was not reproduced. Do not describe this audit as a demonstrated RCE. The advisory is patched in 16.3.6, while other listed Next advisories require 16.3.8.

Several matching update PRs are open but blocked by contribution automation. Fixing that automation does not itself validate updated dependencies. Repair the lockfile/override contract and rerun build/tests/audit together during the later fix phase.

## Every advisory entry

| Severity | Package | Installed | Advisory | Patched range | Title |
|---|---|---|---|---|---|
| critical | `next` | `16.3.5` | [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) | `>=16.3.6` | Next.js: Remote Code Execution in next/og ImageResponse |
| high | `axios` | `1.18.1` | [GHSA-3pq3-5fj3-cg6v](https://github.com/advisories/GHSA-3pq3-5fj3-cg6v) | `>=1.20.0` | Axios: HTTP/2 adapter bypasses configured DNS lookup and proxy controls |
| high | `axios` | `1.18.1` | [GHSA-542g-h47m-68v8](https://github.com/advisories/GHSA-542g-h47m-68v8) | `>=1.20.0` | Axios: Denial of Service via Unhandled 'error' Event in HTTP/2 ClientHttp2Session Initialization |
| high | `axios` | `1.18.1` | [GHSA-c29m-xwm3-cm6r](https://github.com/advisories/GHSA-c29m-xwm3-cm6r) | `>=1.20.0` | Axios: ReDoS in fromDataURI data: URL parser freezes the Node event loop (DoS) |
| high | `axios` | `1.18.1` | [GHSA-m8m8-qj5v-23w3](https://github.com/advisories/GHSA-m8m8-qj5v-23w3) | `>=1.20.0` | Axios: Node HTTP adapter prototype-pollution gadget allows request socket hijack via inherited createConnection |
| high | `axios` | `1.18.1` | [GHSA-mghh-pgcx-3jjj](https://github.com/advisories/GHSA-mghh-pgcx-3jjj) | `>=1.20.0` | Axios: ReDoS (O(N²)) in shouldBypassProxy host normalization, reachable via untrusted redirect Location |
| high | `axios` | `1.18.1` | [GHSA-r4gj-5m52-g5wh](https://github.com/advisories/GHSA-r4gj-5m52-g5wh) | `>=1.20.0` | Axios: maxRedirects: 0 is not enforced by the fetch adapter, allowing redirect-based SSRF |
| high | `axios` | `1.18.1` | [GHSA-x97p-jq2g-jp4f](https://github.com/advisories/GHSA-x97p-jq2g-jp4f) | `>=1.20.0` | Axios: Prototype Pollution Gadget in axios toFormData Options |
| high | `brace-expansion` | `1.1.18` | [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | `>=1.1.19` | brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion |
| high | `brace-expansion` | `2.1.4` | [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | `>=2.1.5` | brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion |
| high | `brace-expansion` | `5.0.9` | [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | `>=5.0.10` | brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion |
| high | `brace-expansion` | `1.1.18` | [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | `>=1.1.20` | brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion |
| high | `brace-expansion` | `2.1.4` | [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | `>=2.1.6` | brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion |
| high | `brace-expansion` | `5.0.9` | [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | `>=5.0.11` | brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion |
| high | `braces` | `3.0.3` | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | `>=3.0.4` | braces vulnerable to stack-exhaustion denial of service through deeply nested patterns |
| high | `next` | `16.3.5` | [GHSA-cjq9-62q9-8jv4](https://github.com/advisories/GHSA-cjq9-62q9-8jv4) | `>=16.3.8` | Next.js has Server-Side Request Forgery in Image Optimization |
| high | `sharp` | `0.35.4` | [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) | `>=0.35.5` | sharp : Vulnerability in librsvg dependency CVE-2026-96889 |
| high | `source-map-js` | `1.2.1` | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | `>=1.2.2` | source-map-js allows event-loop denial of service through indexed source-map section offsets |
| moderate | `axios` | `1.18.1` | [GHSA-44g4-m2mj-wpvx](https://github.com/advisories/GHSA-44g4-m2mj-wpvx) | `>=1.20.0` | Axios: CIDR-form NO_PROXY entries are ignored, causing proxy exclusion bypass for internal IP ranges |
| moderate | `axios` | `1.18.1` | [GHSA-4hqw-qxg8-jxx2](https://github.com/advisories/GHSA-4hqw-qxg8-jxx2) | `>=1.20.0` | Axios: Fetch Adapter Header Injection via Inherited FormData getHeaders |
| moderate | `axios` | `1.18.1` | [GHSA-9fr6-4gfg-395g](https://github.com/advisories/GHSA-9fr6-4gfg-395g) | `>=1.20.0` | Axios: Prototype-Pollution Gadget in the Default Instance Allows Inherited Object.prototype.method to Override HTTP Method |
| moderate | `axios` | `1.18.1` | [GHSA-j8rh-479h-cp32](https://github.com/advisories/GHSA-j8rh-479h-cp32) | `>=1.20.0` | Axios: Header Injection via Inherited headers After Minimal Interceptor |
| moderate | `axios` | `1.18.1` | [GHSA-vh66-26gq-q6x8](https://github.com/advisories/GHSA-vh66-26gq-q6x8) | `>=1.20.0` | Axios: Prototype pollution gadget in fetch adapter can alter outbound requests |
| moderate | `brace-expansion` | `1.1.18` | [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | `>=1.1.21` | brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service |
| moderate | `brace-expansion` | `2.1.4` | [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | `>=2.1.7` | brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service |
| moderate | `brace-expansion` | `5.0.9` | [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | `>=5.0.12` | brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service |
| moderate | `fast-uri` | `3.1.7` | [GHSA-hrr3-gc8f-f4qj](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj) | `>=3.1.8` | fast-uri vulnerable to inconsistent host case normalization via percent-encoded octets |
| moderate | `next` | `16.3.5` | [GHSA-3w37-wq28-93x7](https://github.com/advisories/GHSA-3w37-wq28-93x7) | `>=16.3.8` | Next.js: Pending `use cache` fill can leak Draft Mode content into regular responses and persisted pages |
| moderate | `next` | `16.3.5` | [GHSA-4jqv-mc3x-m676](https://github.com/advisories/GHSA-4jqv-mc3x-m676) | `>=16.3.8` | Next.js has cache poisoning of SSG and ISR pages in self-hosted applications |
| moderate | `next` | `16.3.5` | [GHSA-f87g-xv8r-7p7x](https://github.com/advisories/GHSA-f87g-xv8r-7p7x) | `>=16.3.8` | Next.js has information disclosure in App Router metadata image routes via dynamicParams bypass |
| moderate | `next` | `16.3.5` | [GHSA-mcj8-r9mp-w47p](https://github.com/advisories/GHSA-mcj8-r9mp-w47p) | `>=16.3.8` | Next.js has cache poisoning in SSG/ISR rendering that leads to cross-user content substitution and persistent denial of service |
| moderate | `sprintf-js` | `1.0.3` | [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) | `>=1.1.4` | sprintf-js vulnerable to denial of service through unbounded precision specifiers |
| low | `dompurify` | `3.4.13` | [GHSA-6688-9rhm-gjv2](https://github.com/advisories/GHSA-6688-9rhm-gjv2) | `>=3.4.16` | DOMPurify: IN_PLACE returns a force-removed rawtext root whose text carries attacker markup — pure HTML reparse executes |
| low | `dompurify` | `3.4.13` | [GHSA-p98j-92pf-mc4p](https://github.com/advisories/GHSA-p98j-92pf-mc4p) | `>=3.4.16` | DOMPurify: IN_PLACE: node-removing afterSanitize hook leaves detached subtree event handlers armed, causing DOM XSS |
| low | `next` | `16.3.5` | [GHSA-39w2-rjm5-chcv](https://github.com/advisories/GHSA-39w2-rjm5-chcv) | `>=16.3.8` | Next.js has information disclosure in development server's Model Context Protocol endpoint |

## Practical boundaries

The saved production audit excludes a complete development-only audit. It cannot establish image payload reachability, actual token compromise, or production exploitability. The report distinguishes these advisory results from the authorization defects independently confirmed in source/mocks. Resolve duplicated parallel-major overrides without blindly upgrading all consumers to one major.
