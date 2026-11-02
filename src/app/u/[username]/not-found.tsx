import Link from "next/link";
import ProfileThemeWrapper from "@/components/ProfileThemeWrapper";
import { buttonVariants } from "@/components/ui/button";

// Served with a real 404 status so private or unknown profiles are not indexed.
export default function ProfileNotFound() {
  return (
    <ProfileThemeWrapper>
      <div className="flex justify-center px-4 py-20 text-[var(--foreground)]">
        <div className="max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
          <h1 className="mb-2 text-xl font-semibold">Profile Not Found</h1>
          <p className="text-[var(--muted-foreground)] mb-2">
            This profile is not available or has not been made public.
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mb-6">
            If this is your profile, go to{" "}
            <Link
              href="/dashboard/settings"
              className="text-[var(--accent)] underline hover:opacity-80"
            >
              Settings
            </Link>{" "}
            and enable <strong>Public Profile</strong>.
          </p>
          <Link href="/" className={buttonVariants({ size: "sm" })}>
            Back to home
          </Link>
        </div>
      </div>
    </ProfileThemeWrapper>
  );
}
