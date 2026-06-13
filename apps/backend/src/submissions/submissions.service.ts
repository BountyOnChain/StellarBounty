import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Bounty, BountyStatus } from '../entities/bounty.entity';
import {
  Submission,
  SubmissionAttachment,
  SubmissionStatus,
} from '../entities/submission.entity';
import { CreateSubmissionDto } from './submissions.dto';

export type UploadedSubmissionFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type AttachmentDownload = {
  filePath: string;
  originalName: string;
  mimeType: string;
  size: number;
};

type AttachmentTokenPayload = {
  bountyId: string;
  submissionId: string;
  attachmentId: string;
  exp: number;
};

const SUPPORTED_ATTACHMENT_MIME_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
]);

const SUPPORTED_ATTACHMENT_EXTENSIONS = new Set([
  '.gif',
  '.jpeg',
  '.jpg',
  '.pdf',
  '.png',
  '.webp',
  '.zip',
]);

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    @InjectRepository(Bounty)
    private readonly bountyRepo: Repository<Bounty>,
    private readonly config: ConfigService,
  ) {}

  async create(
    bountyId: string,
    dto: CreateSubmissionDto,
    contributorAddress: string,
    files: UploadedSubmissionFile[] = [],
  ) {
    const bounty = await this.bountyRepo.findOneBy({ id: bountyId });
    if (!bounty) throw new NotFoundException('Bounty not found');

    this.validateAttachments(files);
    const submissionId = randomUUID();
    const attachments = await this.storeAttachments(bountyId, submissionId, files);
    const submission = this.submissionRepo.create({
      id: submissionId,
      bountyId,
      link: dto.link,
      notes: dto.notes ?? null,
      contributorAddress,
      attachments,
    });
    const saved = await this.submissionRepo.save(submission);
    return this.withSignedAttachmentUrls(saved);
  }

  async findAll(bountyId: string, ownerAddress: string) {
    const bounty = await this.bountyRepo.findOneBy({ id: bountyId });
    if (!bounty) throw new NotFoundException('Bounty not found');
    if (bounty.ownerAddress !== ownerAddress) throw new ForbiddenException();
    const submissions = await this.submissionRepo.findBy({ bountyId });
    return submissions.map((submission) => this.withSignedAttachmentUrls(submission));
  }

  async resolveAttachmentDownload(
    bountyId: string,
    submissionId: string,
    attachmentId: string,
    token: string | undefined,
  ): Promise<AttachmentDownload> {
    this.verifyAttachmentToken(token, bountyId, submissionId, attachmentId);

    const submission = await this.submissionRepo.findOneBy({ id: submissionId, bountyId });
    if (!submission) throw new NotFoundException('Submission not found');

    const attachment = (submission.attachments ?? []).find((item) => item.id === attachmentId);
    if (!attachment) throw new NotFoundException('Attachment not found');

    const uploadRoot = this.getUploadRoot();
    const filePath = path.resolve(uploadRoot, attachment.storageKey);
    if (!filePath.startsWith(`${uploadRoot}${path.sep}`)) {
      throw new ForbiddenException('Invalid attachment path');
    }

    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundException('Attachment file not found');
    }
    return {
      filePath,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
    };
  }

  async approve(bountyId: string, subId: string, ownerAddress: string) {
    const bounty = await this.bountyRepo.findOneBy({ id: bountyId });
    if (!bounty) throw new NotFoundException('Bounty not found');
    if (bounty.ownerAddress !== ownerAddress) throw new ForbiddenException();

    const alreadyApproved = await this.submissionRepo.findOneBy({
      bountyId,
      status: SubmissionStatus.APPROVED,
    });
    if (alreadyApproved) throw new BadRequestException('A submission is already approved for this bounty');

    const submission = await this.submissionRepo.findOneBy({ id: subId, bountyId });
    if (!submission) throw new NotFoundException('Submission not found');

    await this.callContractApprove(bountyId, ownerAddress);

    submission.status = SubmissionStatus.APPROVED;
    bounty.status = BountyStatus.COMPLETED;
    await this.bountyRepo.save(bounty);
    return this.submissionRepo.save(submission);
  }

  async reject(bountyId: string, subId: string, ownerAddress: string) {
    const bounty = await this.bountyRepo.findOneBy({ id: bountyId });
    if (!bounty) throw new NotFoundException('Bounty not found');
    if (bounty.ownerAddress !== ownerAddress) throw new ForbiddenException();

    const submission = await this.submissionRepo.findOneBy({ id: subId, bountyId });
    if (!submission) throw new NotFoundException('Submission not found');

    submission.status = SubmissionStatus.REJECTED;
    return this.submissionRepo.save(submission);
  }

  private async callContractApprove(bountyId: string, ownerAddress: string): Promise<void> {
    const contractId =
      this.config.get<string>(`SOROBAN_CONTRACT_${bountyId.toUpperCase()}`) ??
      this.config.get<string>('SOROBAN_CONTRACT_ID');
    if (!contractId) return; // no contract configured — skip (dev/test mode)

    const network = this.config.get<string>('STELLAR_NETWORK', 'testnet');
    const rpcUrl =
      this.config.get<string>('STELLAR_RPC_URL') ??
      (network === 'mainnet'
        ? 'https://mainnet.stellar.validationcloud.io/v1/rpc'
        : 'https://soroban-testnet.stellar.org');

    const server = new StellarSdk.rpc.Server(rpcUrl);
    const networkPassphrase =
      network === 'mainnet'
        ? StellarSdk.Networks.PUBLIC
        : StellarSdk.Networks.TESTNET;

    try {
      const account = await server.getAccount(ownerAddress);

      const contract = new StellarSdk.Contract(contractId);
      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase,
      })
        .addOperation(
          contract.call('approve', StellarSdk.nativeToScVal(ownerAddress, { type: 'address' })),
        )
        .setTimeout(30)
        .build();

      const prepared = await server.prepareTransaction(tx);
      // The backend signs only if a server-side signing key is configured.
      const signingSecret = this.config.get<string>('STELLAR_SIGNING_SECRET');
      if (signingSecret) {
        const signingKeypair = StellarSdk.Keypair.fromSecret(signingSecret);
        prepared.sign(signingKeypair);
        await server.sendTransaction(prepared);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Stellar contract approval skipped after RPC failure: bountyId=${bountyId}, contractId=${contractId}, rpcUrl=${rpcUrl}, error=${message}`,
      );
    }
    // If no signing secret, the transaction is prepared but not submitted —
    // the client is expected to sign and submit it separately.
  }

  private validateAttachments(files: UploadedSubmissionFile[]) {
    const maxFiles = this.config.get<number>('SUBMISSION_UPLOAD_MAX_FILES', 5);
    const maxFileSize = this.config.get<number>(
      'SUBMISSION_UPLOAD_MAX_FILE_SIZE_BYTES',
      10 * 1024 * 1024,
    );

    if (files.length > maxFiles) {
      throw new BadRequestException(`Submissions can include at most ${maxFiles} files`);
    }

    for (const file of files) {
      const extension = path.extname(file.originalname).toLowerCase();
      if (
        !SUPPORTED_ATTACHMENT_MIME_TYPES.has(file.mimetype) ||
        !SUPPORTED_ATTACHMENT_EXTENSIONS.has(extension)
      ) {
        throw new BadRequestException(
          'Submission attachments must be images, PDFs, or ZIP archives',
        );
      }

      if (file.size > maxFileSize) {
        throw new BadRequestException(
          `Submission attachments must be ${maxFileSize} bytes or smaller`,
        );
      }

      if (!file.buffer) {
        throw new BadRequestException('Submission attachment data is missing');
      }
    }
  }

  private async storeAttachments(
    bountyId: string,
    submissionId: string,
    files: UploadedSubmissionFile[],
  ): Promise<SubmissionAttachment[]> {
    if (files.length === 0) return [];

    const uploadRoot = this.getUploadRoot();
    const directory = path.join(
      uploadRoot,
      this.safeSegment(bountyId),
      this.safeSegment(submissionId),
    );
    await fs.mkdir(directory, { recursive: true });

    const attachments: SubmissionAttachment[] = [];
    for (const file of files) {
      const attachmentId = randomUUID();
      const fileName = `${attachmentId}-${this.safeFileName(file.originalname)}`;
      const filePath = path.join(directory, fileName);
      await fs.writeFile(filePath, file.buffer);

      attachments.push({
        id: attachmentId,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey: path.relative(uploadRoot, filePath).split(path.sep).join('/'),
        uploadedAt: new Date().toISOString(),
      });
    }

    return attachments;
  }

  private withSignedAttachmentUrls(submission: Submission): Submission {
    const attachments = submission.attachments ?? [];
    return {
      ...submission,
      attachments: attachments.map((attachment) => ({
        ...attachment,
        downloadUrl: this.createSignedAttachmentUrl(
          submission.bountyId,
          submission.id,
          attachment.id,
        ),
      })),
    };
  }

  private createSignedAttachmentUrl(
    bountyId: string,
    submissionId: string,
    attachmentId: string,
  ): string {
    const ttlSeconds = this.config.get<number>('SUBMISSION_UPLOAD_SIGNED_URL_TTL_SECONDS', 900);
    const payload: AttachmentTokenPayload = {
      bountyId,
      submissionId,
      attachmentId,
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    };
    const token = this.signAttachmentToken(payload);
    return `/bounties/${encodeURIComponent(bountyId)}/submissions/${encodeURIComponent(
      submissionId,
    )}/attachments/${encodeURIComponent(attachmentId)}/download?token=${encodeURIComponent(
      token,
    )}`;
  }

  private signAttachmentToken(payload: AttachmentTokenPayload): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.getSigningSecret())
      .update(encodedPayload)
      .digest('base64url');
    return `${encodedPayload}.${signature}`;
  }

  private verifyAttachmentToken(
    token: string | undefined,
    bountyId: string,
    submissionId: string,
    attachmentId: string,
  ) {
    if (!token) throw new ForbiddenException('Attachment token is required');

    const tokenParts = token.split('.');
    if (tokenParts.length !== 2) throw new ForbiddenException('Invalid attachment token');

    const [encodedPayload, signature] = tokenParts;
    if (!encodedPayload || !signature) throw new ForbiddenException('Invalid attachment token');

    const expectedSignature = createHmac('sha256', this.getSigningSecret())
      .update(encodedPayload)
      .digest('base64url');
    const actual = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new ForbiddenException('Invalid attachment token');
    }

    let payload: AttachmentTokenPayload;
    try {
      payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as AttachmentTokenPayload;
    } catch {
      throw new ForbiddenException('Invalid attachment token');
    }

    if (
      payload.bountyId !== bountyId ||
      payload.submissionId !== submissionId ||
      payload.attachmentId !== attachmentId ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      throw new ForbiddenException('Invalid attachment token');
    }
  }

  private getUploadRoot(): string {
    const configured = this.config.get<string>('SUBMISSION_UPLOAD_DIR', 'uploads/submissions');
    return path.resolve(configured);
  }

  private getSigningSecret(): string {
    return (
      this.config.get<string>('SUBMISSION_UPLOAD_SIGNING_SECRET') ??
      this.config.get<string>('JWT_SECRET') ??
      'local-submission-upload-secret'
    );
  }

  private safeFileName(fileName: string): string {
    const baseName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    return baseName || 'attachment';
  }

  private safeSegment(segment: string): string {
    return segment.replace(/[^a-zA-Z0-9_-]/g, '_');
  }
}
