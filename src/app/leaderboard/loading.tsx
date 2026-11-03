import PageHeader from "@/components/shell/PageHeader";
import PixelLoader from "@/components/buddy/PixelLoader";

export default function Loading() {
  return (
    <>
      <PageHeader
        title="Leaderboard"
        description="Developers who made their profile public, ranked by streak, commits and pull requests."
      />
      <PixelLoader label="Loading hi-scores" />
    </>
  );
}
