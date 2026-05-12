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

export interface HuddleAward {
  id: string;
  huddleId: string;
  rosterId: number;
  glyph: string;
  color: string;
  title: string;
  description: string | null;
  season: string | null;
  createdAt: string;
}
