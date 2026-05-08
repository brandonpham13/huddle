export type ClaimStatus = "pending" | "approved" | "rejected";

export interface Huddle {
  id: string;
  leagueProvider: string;
  leagueId: string;
  name: string;
  commissionerUserId: string;
  inviteCode?: string;
  inviteCodeUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSummary {
  id: string;
  username: string | null;
  email: string | null;
}

export interface HuddleDetail extends Huddle {
  commissioner: UserSummary;
  isCommissioner: boolean;
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
