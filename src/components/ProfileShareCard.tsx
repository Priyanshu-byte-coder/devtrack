interface ProfileShareCardProps {
  username: string;
  streak: number;
  profileUrl: string;
}

export default function ProfileShareCard({
  username,
  streak,
  profileUrl,
}: ProfileShareCardProps) {
  return (
    <div
      id="share-card"
      className="mx-auto max-w-md rounded-2xl border bg-[var(--card)] p-6 shadow-lg"
    >
      <div className="text-center">
        <h2 className="text-2xl font-bold">{username}</h2>

        <div className="mt-4 text-4xl">
          🔥
        </div>

        <p className="mt-2 text-lg font-semibold">
          {streak}-Day Streak
        </p>

        <p className="mt-4 break-all text-sm text-[var(--muted-foreground)]">
          {profileUrl}
        </p>

        <div className="mt-6 border-t pt-4 font-bold">
          DevTrack
        </div>
      </div>
    </div>
  );
}