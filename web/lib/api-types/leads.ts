export type LeadListItem = {
  id: string;
  email: string;
  name: string | null;
  question: string | null;
  conversationId: string | null;
  createdAt: string;
};

export type LeadListResponse = {
  items: LeadListItem[];
  nextCursor: string | null;
};
