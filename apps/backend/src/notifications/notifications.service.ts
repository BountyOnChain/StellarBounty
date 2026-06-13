import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { Bounty } from '../entities/bounty.entity';
import { Submission } from '../entities/submission.entity';

type RealtimeEvent =
  | 'bounty.created'
  | 'bounty.updated'
  | 'submission.received'
  | 'submission.approved'
  | 'submission.rejected'
  | 'bounty.completed';

type RealtimePayload = {
  bountyId: string;
  bountyTitle?: string;
  bountyStatus?: string;
  submissionId?: string;
  submissionStatus?: string;
  ownerAddress?: string;
  contributorAddress?: string;
  occurredAt: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private server: Server | null = null;

  bindServer(server: Server) {
    this.server = server;
  }

  emitBountyCreated(bounty: Bounty) {
    this.emit('bounty.created', {
      bountyId: bounty.id,
      bountyTitle: bounty.title,
      bountyStatus: bounty.status,
      ownerAddress: bounty.ownerAddress,
    });
  }

  emitBountyUpdated(bounty: Bounty) {
    this.emit('bounty.updated', {
      bountyId: bounty.id,
      bountyTitle: bounty.title,
      bountyStatus: bounty.status,
      ownerAddress: bounty.ownerAddress,
    });
  }

  emitSubmissionReceived(bounty: Bounty, submission: Submission) {
    this.emit('submission.received', {
      bountyId: bounty.id,
      bountyTitle: bounty.title,
      bountyStatus: bounty.status,
      submissionId: submission.id,
      submissionStatus: submission.status,
      ownerAddress: bounty.ownerAddress,
      contributorAddress: submission.contributorAddress,
    });
  }

  emitSubmissionStatusChanged(
    event: Extract<RealtimeEvent, 'submission.approved' | 'submission.rejected'>,
    bounty: Bounty,
    submission: Submission,
  ) {
    this.emit(event, {
      bountyId: bounty.id,
      bountyTitle: bounty.title,
      bountyStatus: bounty.status,
      submissionId: submission.id,
      submissionStatus: submission.status,
      ownerAddress: bounty.ownerAddress,
      contributorAddress: submission.contributorAddress,
    });
  }

  emitBountyCompleted(bounty: Bounty, submission: Submission) {
    this.emit('bounty.completed', {
      bountyId: bounty.id,
      bountyTitle: bounty.title,
      bountyStatus: bounty.status,
      submissionId: submission.id,
      submissionStatus: submission.status,
      ownerAddress: bounty.ownerAddress,
      contributorAddress: submission.contributorAddress,
    });
  }

  private emit(event: RealtimeEvent, payload: Omit<RealtimePayload, 'occurredAt'>) {
    if (!this.server) {
      return;
    }

    const message: RealtimePayload = {
      ...payload,
      occurredAt: new Date().toISOString(),
    };

    this.server.emit(event, message);
    this.logger.debug(`Emitted ${event} for bounty=${message.bountyId}`);
  }
}
