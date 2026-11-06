import type { Metadata } from "next";

// The page is a client component, so its tab title lives here.
export const metadata: Metadata = { title: "Sign in" };

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
