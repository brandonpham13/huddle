export type ClaimStatus = "pending" | "approved" | "rejected";
export type HuddleMemberStatus = "commissioner" | "approved" | "pending";

export interface Huddle {
  id: string;
  leagueProvider: string | null;
  leagueId: string | null;
  name: string;
  inviteCode?: string;
  inviteCodeUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
  myStatus?: HuddleMemberStatus;
}

export interface UserSummary {
  id: string;
  username: string | null;
  email: string | null;
}

export interface CommissionerSummary {
  userId: string;
  addedAt: string;
  user: UserSummary;
}

export interface HuddleDetail extends Huddle {
  isCommissioner: boolean;
  commissioners: CommissionerSummary[];
}

export interface HuddleClaim {
  id: string;
  huddleId?: string;
  rosterId: number;
  status: ClaimStatus;
  message: string | null;
  userId: string;
  createdAt: string;
  decidedAt: string | null;
}

export interface HuddleClaimSummary {
  id: string;
  rosterId: number;
  status: ClaimStatus;
  message: string | null;
  createdAt: string;
  decidedAt: string | null;
  user: UserSummary | null;
}

export interface HuddleDetailResponse {
  huddle: HuddleDetail;
  claims: HuddleClaimSummary[];
  myClaim: { id: string; rosterId: number; status: ClaimStatus } | null;
}

export interface HuddleAnnouncement {
  id: string;
  huddleId: string;
  authorId: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayoutEntry {
  id: string;
  label: string;
  /** Amount in cents (e.g. 5000 = $50.00) */
  amount: number;
  sortOrder: number;
}
