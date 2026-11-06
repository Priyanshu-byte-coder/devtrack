"use client";

import { m } from "motion/react";
import type { DuelRound } from "@/lib/duel";
import { duration, ease } from "@/lib/motion";

const fmt = new Intl.NumberFormat("en-US");

const P1 = "var(--accent)";
const P2 = "#fb7185";

function value(round: DuelRound, side: "left" | "right") {
  const v = round[side];
  if (v === null) return "Hidden";
  return `${fmt.format(v)}${round.unit ?? ""}`;
}

/**
 * Round-by-round tug of war. Each bar splits at the left fighter's share;
 * both halves grow out from the centre when the row scrolls into view.
 *
 * The row (not the bar halves) is watched for visibility: a half at
 * scaleX(0) has no area and would never count as visible. At rest (reduced
 * motion, no JS) the halves are already at their real widths.
 */
export default function DuelRounds({
  rounds,
  leftLogin,
  rightLogin,
}: {
  rounds: DuelRound[];
  leftLogin: string;
  rightLogin: string;
}) {
  return (
    <ol className="space-y-3">
      {rounds.map((round, i) => {
        const contested = round.winner !== null;
        const leftPct = Math.round(round.leftShare * 1000) / 10;
        const result =
          round.winner === null
            ? "no contest"
            : round.winner === "tie"
              ? "tie"
              : `@${round.winner === "left" ? leftLogin : rightLogin} wins`;
        return (
          <m.li
            key={round.key}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.6 }}
            className="bg-[var(--card)] px-3 py-3 sm:px-4"
          >
            <div className="grid grid-cols-2 items-baseline gap-x-3 gap-y-1 sm:grid-cols-[1fr_auto_1fr]">
              <span
                className={`truncate font-pixel text-base tabular-nums sm:text-lg ${
                  round.winner === "left"
                    ? "text-[var(--accent)]"
                    : "text-[var(--muted-foreground)]"
                }`}
              >
                {round.winner === "left" && <span aria-hidden="true">★ </span>}
                {value(round, "left")}
              </span>
              <span className="order-first col-span-2 text-center font-pixel text-[10px] uppercase tracking-[0.12em] text-[var(--card-foreground)] sm:order-none sm:col-span-1">
                <span className="text-[var(--muted-foreground)]">
                  R{i + 1} ·{" "}
                </span>
                {round.label}
              </span>
              <span
                className={`truncate text-right font-pixel text-base tabular-nums sm:text-lg ${
                  round.winner === "right"
                    ? "text-[#fb7185]"
                    : "text-[var(--muted-foreground)]"
                }`}
              >
                {value(round, "right")}
                {round.winner === "right" && <span aria-hidden="true"> ★</span>}
              </span>
            </div>
            <span className="sr-only">
              {round.label}: @{leftLogin} {value(round, "left")}, @{rightLogin}{" "}
              {value(round, "right")}, {result}.
            </span>

            <div
              aria-hidden="true"
              className="mt-2 flex h-3 border-2 border-[var(--border)] bg-[var(--control)]"
            >
              {contested ? (
                <>
                  <m.div
                    data-reveal=""
                    className="h-full origin-right"
                    style={{ width: `${leftPct}%`, background: P1 }}
                    variants={grow}
                  />
                  <span className="w-0.5 shrink-0 bg-[var(--card)]" />
                  <m.div
                    data-reveal=""
                    className="h-full flex-1 origin-left"
                    style={{ background: P2 }}
                    variants={grow}
                  />
                </>
              ) : (
                <span className="flex-1" />
              )}
            </div>
          </m.li>
        );
      })}
    </ol>
  );
}

const grow = {
  hidden: { scaleX: 0 },
  visible: {
    scaleX: 1,
    transition: { duration: duration.slower, ease: ease.out, delay: 0.1 },
  },
};
