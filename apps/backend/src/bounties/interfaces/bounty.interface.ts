export type BountyStatus = 'open' | 'closed' | 'paid';

export interface Bounty {
  id: string;
  title: string;
  description: string;
  rewardAmount: number; // XLM
  deadline: string; // ISO 8601
  status: BountyStatus;
  ownerAddress: string; // Stellar wallet public key
  tags?: string[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
