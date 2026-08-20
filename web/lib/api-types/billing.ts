export type CheckoutSessionResponse = {
  url: string;
};

export type PortalSessionResponse = {
  url: string;
};

export type SessionStatusOutcome = "succeeded" | "incomplete" | "expired";

export type SessionStatusResponse = {
  outcome: SessionStatusOutcome;
};
