export type StoreRole = "owner" | "editor" | "viewer";

export type AccessLevel = "owner" | "editor" | "viewer" | "public" | "none";

export type StoreMember = {
  id: string;
  storeId: string;
  userId: string;
  role: StoreRole;
  joinedAt: Date | null;
  // Derived (server-resolved via Clerk) — absent if the lookup fails/degrades.
  displayName?: string;
  imageUrl?: string | null;
};

/** Minimal public profile for a Clerk user id (name + avatar), server-resolved. */
export type UserProfile = { displayName: string; imageUrl: string | null };

export type StoreInvite = {
  id: string;
  storeId: string;
  token: string;
  role: "editor";
  expiresAt: Date;
  claimedAt: Date | null;
  createdBy: string;
};
