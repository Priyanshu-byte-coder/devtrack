import { useMemo, useState } from "react";

export function useLastUpdated() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const relativeLabel = useMemo(() => {
    if (!lastUpdated) return "Never updated";

    const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);

    if (diff < 60) return "Updated just now";

    if (diff < 3600) {
      const mins = Math.floor(diff / 60);
      return `Updated ${mins} minute${mins === 1 ? "" : "s"} ago`;
    }

    if (diff < 86400) {
      const hours = Math.floor(diff / 3600);
      return `Updated ${hours} hour${hours === 1 ? "" : "s"} ago`;
    }

    const days = Math.floor(diff / 86400);
    return `Updated ${days} day${days === 1 ? "" : "s"} ago`;
  }, [lastUpdated]);

  return {
    lastUpdated,
    setLastUpdated,
    relativeLabel,
  };
}