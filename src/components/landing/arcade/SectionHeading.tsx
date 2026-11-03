import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/Reveal";

/** Eyebrow, pixel heading and an optional lede, shared by every landing section. */
export default function SectionHeading({
  id,
  eyebrow,
  title,
  children,
  center = false,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  center?: boolean;
}) {
  return (
    <Reveal className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="font-pixel text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
        {eyebrow}
      </p>
      <h2
        id={id}
        className="mt-3 font-pixel text-[clamp(1.8rem,4vw,2.9rem)] uppercase leading-none text-[var(--foreground)]"
      >
        {title}
      </h2>
      {children && (
        <p className="mt-4 text-base leading-7 text-[var(--muted-foreground)]">
          {children}
        </p>
      )}
    </Reveal>
  );
}
