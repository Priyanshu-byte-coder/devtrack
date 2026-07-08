interface LastUpdatedTimestampProps {
  lastUpdated: Date | null;
  relativeLabel: string;
}

export default function LastUpdatedTimestamp({
  lastUpdated,
  relativeLabel,
}: LastUpdatedTimestampProps) {
  if (!lastUpdated) return null;

  return (
    <span
      className="text-xs text-gray-500"
      title={lastUpdated.toLocaleString()}
    >
      {relativeLabel}
    </span>
  );
}