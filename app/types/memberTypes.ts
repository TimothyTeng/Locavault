export type StoreRole = "owner" | "editor" | "viewer";
 
export type AccessLevel = "owner" | "editor" | "viewer" | "public" | "none";
 
export type StoreMember = {
  id: string;
  storeId: string;
  userId: string;
  role: StoreRole;
  joinedAt: Date | null;
};
 
export type StoreInvite = {
  id: string;
  storeId: string;
  token: string;
  role: "editor";
  expiresAt: Date;
  claimedAt: Date | null;
  createdBy: string;
};