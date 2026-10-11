// Game rules shared by the API server and the web app's offline mode.
export type Lean = "Left" | "Center" | "Right";
export type VoteKind = "cause" | "action";

export const LEANS: Lean[] = ["Left", "Center", "Right"];
export const MAX_VOICE = 10;
export const XP_PER_BRIDGE = 35;
export const LEVELS = ["Bystander", "Witness", "Correspondent", "Analyst", "Envoy"];

/** Quadratic voting: strength n costs n² Voice. */
export const voteCost = (strength: number): number => strength * strength;

/** Strength 1 always; strengths 2-3 unlock once all three perspectives are read. */
export const maxStrength = (reads: readonly Lean[]): number => (LEANS.every((l) => reads.includes(l)) ? 3 : 1);

export const dayKey = (d = new Date()): string => d.toISOString().slice(0, 10);

export function nextStreak(streak: number, lastBridge: string | null, today: string): number {
  if (lastBridge === today) return streak;
  const yesterday = dayKey(new Date(Date.parse(today) - 86_400_000));
  return lastBridge === yesterday ? streak + 1 : 1;
}

export const levelOf = (xp: number) => Math.min(LEVELS.length - 1, Math.floor(xp / 100));

export const isBlindspot = (c: { left: number; right: number }) => c.left < 10 || c.right < 10;

export interface BadgeState { id: string; label: string; earned: boolean }

export function badgesFor(fullyRead: { continent: string; blindspot: boolean }[], streak: number): BadgeState[] {
  return [
    { id: "blindspot", label: "Blindspot Hunter", earned: fullyRead.some((p) => p.blindspot) },
    { id: "continents", label: "Five Continents", earned: new Set(fullyRead.map((p) => p.continent)).size >= 5 },
    { id: "streak7", label: "7-Day Bridge", earned: streak >= 7 },
  ];
}
