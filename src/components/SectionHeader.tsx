type SectionHeaderProps = {
  title: string;
};

export default function SectionHeader({
  title,
}: SectionHeaderProps) {
  return (
    <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
      {title}
    </h2>
  );
}