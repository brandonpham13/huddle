export type ClaimStatus = 'pending' | 'approved' | 'rejected'

export interface Group {
  id: string
  leagueProvider: string
  leagueId: string
  name: string
  commissionerUserId: string
  createdAt: string
  updatedAt: string
}

export interface UserSummary {
  id: string
  username: string | null
  email: string | null
}

export interface GroupDetail extends Group {
  commissioner: UserSummary
  isCommissioner: boolean
}

export interface GroupClaim {
  id: string
  groupId?: string
  rosterId: number
  status: ClaimStatus
  message: string | null
  userId: string
  createdAt: string
  decidedAt: string | null
}

export interface GroupClaimSummary {
  id: string
  rosterId: number
  status: ClaimStatus
  message: string | null
  createdAt: string
  decidedAt: string | null
  user: UserSummary | null
}

export interface GroupDetailResponse {
  group: GroupDetail
  claims: GroupClaimSummary[]
  myClaim: { id: string; rosterId: number; status: ClaimStatus } | null
}
