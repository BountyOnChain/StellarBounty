export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface Submission {
  id: string;
  bountyId: string;
  submitterAddress: string; // Stellar wallet public key
  workLink: string;
  notes?: string;
  status: SubmissionStatus;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface SubmissionStore {
  [id: string]: Submission;
}
