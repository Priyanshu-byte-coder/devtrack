import ProfileCardPageClient from "@/components/ProfileCardPageClient";

export default function Page() {
  return (
    <main className="min-h-screen bg-[var(--background)] p-6 text-[var(--foreground)]">
      <h1 className="mb-4 text-2xl font-bold">Profile Card</h1>
      <ProfileCardPageClient />
    </main>
  );
}
