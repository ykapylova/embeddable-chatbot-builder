export type GapItem = {
  /** Normalised question text, stable across requests — used to key React lists. */
  key: string;
  question: string;
  count: number;
  lastAskedAt: string;
  sampleConversationId: string | null;
};

export type GapsResponse =
  | { gated: true; count: number }
  | { gated: false; count: number; items: GapItem[] };
