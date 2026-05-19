export interface Bounty {
  id: string;
  ownerAddress: string; // Stellar wallet public key of the bounty creator
  title: string;
  description: string;
  reward: number;
  status: 'open' | 'closed' | 'paid';
  createdAt: string;
  updatedAt: string;
}

export interface BountyStore {
  [id: string]: Bounty;
}
