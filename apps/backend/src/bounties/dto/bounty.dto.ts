import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  IsString,
  IsOptional,
  IsArray,
  IsISO8601,
  IsEnum,
  IsNotEmpty,
  MinLength,
  MaxLength,
  ValidateBy,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { BountyStatus } from '../../entities/bounty.entity';

export const MAX_REWARD_AMOUNT = 1_000_000_000n;

/** Strip HTML tags and normalize whitespace to prevent stored XSS */
function SanitizeString() {
  return Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    return value
      .replace(/<[^>]*>/g, '')           // strip HTML tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/\s+/g, ' ')              // normalize whitespace
      .trim();
  });
}

/** Transform string/number input to bigint for internal use */
function ToStroopBigInt() {
  return Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) return BigInt(value);
    return value;
  });
}

function IsRewardAmount() {
  return ValidateBy({
    name: 'isRewardAmount',
    validator: {
      validate(value: unknown) {
        try {
          const str = typeof value === 'bigint' ? value.toString() : value;
          if (typeof str !== 'string' || !/^\d+$/.test(str)) {
            return false;
          }

          const amount = BigInt(str);
          return amount > 0n && amount <= MAX_REWARD_AMOUNT;
        } catch {
          return false;
        }
      },
      defaultMessage() {
        return `rewardAmount must be a whole number between 1 and ${MAX_REWARD_AMOUNT.toString()}`;
      },
    },
  });
}

function IsStellarPublicKey() {
  return ValidateBy({
    name: 'isStellarPublicKey',
    validator: {
      validate(value: unknown) {
        return typeof value === 'string' && StellarSdk.StrKey.isValidEd25519PublicKey(value);
      },
      defaultMessage() {
        return 'ownerAddress must be a valid Stellar public key';
      },
    },
  });
}

function IsFutureIsoDate() {
  return ValidateBy({
    name: 'isFutureIsoDate',
    validator: {
      validate(value: unknown) {
        if (typeof value !== 'string') {
          return false;
        }

        const timestamp = new Date(value).getTime();
        return Number.isFinite(timestamp) && timestamp > Date.now();
      },
      defaultMessage() {
        return 'deadline must be a future ISO 8601 date';
      },
    },
  });
}

export class CreateBountyDto {
  @ApiProperty({
    description: 'Title of the bounty',
    example: 'Build a Stellar payment integration',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  @SanitizeString()
  title!: string;

  @ApiProperty({
    description: 'Detailed description of the bounty requirements',
    example: 'Implement a Stellar payment gateway that supports XLM and USDC...',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(5000)
  @SanitizeString()
  description!: string;

  @ApiProperty({
    description: 'Reward amount in XLM (in stroops)',
    example: '10000000',
  })
  @IsNotEmpty()
  @ToStroopBigInt()
  @IsRewardAmount()
  rewardAmount!: string | bigint;

  @ApiProperty({
    description: 'Stellar wallet address of the bounty owner',
    example: 'GABC...',
  })
  @IsString()
  @IsNotEmpty()
  @IsStellarPublicKey()
  ownerAddress!: string;

  @ApiPropertyOptional({
    description: 'Array of tags for categorization',
    example: ['Stellar', 'Payment', 'Integration'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Deadline for the bounty (ISO 8601)',
    example: '2025-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsISO8601()
  @IsFutureIsoDate()
  deadline?: string;
}

export class UpdateBountyDto {
  @ApiPropertyOptional({ description: 'Updated title' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  @SanitizeString()
  title?: string;

  @ApiPropertyOptional({ description: 'Updated description' })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  @SanitizeString()
  description?: string;

  @ApiPropertyOptional({ description: 'Updated reward amount in XLM' })
  @IsOptional()
  @ToStroopBigInt()
  @IsRewardAmount()
  rewardAmount?: string | bigint;

  @ApiPropertyOptional({ description: 'Bounty owner wallet address' })
  @IsOptional()
  @IsString()
  @IsStellarPublicKey()
  ownerAddress?: string;

  @ApiPropertyOptional({ description: 'Updated tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Updated deadline (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  @IsFutureIsoDate()
  deadline?: string;

  @ApiPropertyOptional({
    description: 'Bounty status',
    enum: BountyStatus,
  })
  @IsOptional()
  @IsEnum(BountyStatus)
  status?: BountyStatus;
}

export class BountyResponseDto {
  @ApiProperty({ description: 'Unique identifier' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'Bounty title' })
  @IsString()
  title!: string;

  @ApiProperty({ description: 'Bounty description' })
  @IsString()
  description!: string;

  @ApiProperty({ description: 'Reward in XLM' })
  @IsString()
  rewardAmount!: string;

  @ApiProperty({ description: 'Deadline date' })
  @IsString()
  deadline!: string;

  @ApiProperty({
    description: 'Current status',
    enum: BountyStatus,
  })
  @IsString()
  status!: string;

  @ApiProperty({ description: 'Owner wallet address' })
  @IsString()
  ownerAddress!: string;

  @ApiPropertyOptional({ description: 'Tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ description: 'Creation timestamp' })
  @IsString()
  createdAt!: string;

  @ApiProperty({ description: 'Last update timestamp' })
  @IsString()
  updatedAt!: string;
}
