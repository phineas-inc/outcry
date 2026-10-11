import type { BadgeState, Lean, VoteKind } from "@shared/rules.ts";
export type { BadgeState, Lean, VoteKind };

export type Topic = "labor" | "climate" | "democracy" | "rights" | "economy" | "other";
export type Status = "active" | "escalating" | "winding down";

export interface Article { outlet: string; lean: Lean; headline: string; publishedAt: string; url?: string }

export interface Protest {
  id: string; title: string; summary: string; city: string; country: string; continent: string;
  lat: number; lng: number; startDate: string; crowdEstimate: number | null; topic: Topic; status: Status;
  coverage: { left: number; center: number; right: number; rated?: number; sourceCount: number };
  articles: Article[]; causeScore: number; actionScore: number;
  summaryAi?: boolean; articleCount?: number; updatedAt?: string;
}

export interface PipelineStatus { lastCollect: string | null; lastBuild: string | null; movements: number; articlesTracked: number }

export interface Me {
  credits: number; xp: number; level: number; streak: number;
  votes: Record<string, { cause: number; action: number }>;
  reads: Record<string, Lean[]>;
  badges: BadgeState[];
}
