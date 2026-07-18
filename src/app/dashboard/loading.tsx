export default function Loading() {
  return (
    <div className="flex-1 p-6 lg:p-8 animate-pulse">
      <div className="mb-8 flex flex-col gap-4">
        <div className="h-8 w-64 bg-[var(--card-muted)] rounded"></div>
        <div className="h-4 w-96 bg-[var(--card-muted)] rounded"></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-[var(--card-muted)] rounded-xl border border-[var(--border)]"></div>
        ))}
      </div>
      <div className="h-96 bg-[var(--card-muted)] rounded-xl border border-[var(--border)]"></div>
    </div>
  );
}
