type SectionHeaderProps = {
  title: string;
};

export default function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <h2 className="font-pixel text-sm uppercase tracking-[0.12em] text-[var(--card-foreground)]">
      {title}
    </h2>
  );
}
