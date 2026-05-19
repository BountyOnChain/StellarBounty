import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Stellar wallet public key (G...)',
    example: 'GBR3C4O...',
  })
  publicKey: string;

  @ApiProperty({
    description:
      'Signed challenge message using Freighter or Stellar wallet',
    example:
      'AAAAAABc...base64-encoded-xdr-signature...',
  })
  signature: string;

  @ApiPropertyOptional({
    description: 'Optional recovery phrase (not recommended)',
    example: '',
  })
  recoveryPhrase?: string;
}

export class ChallengeDto {
  @ApiProperty({
    description: 'Challenge nonce to sign with your Stellar wallet',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  nonce: string;

  @ApiProperty({
    description: 'Message to sign',
    example: 'StellarBounty Login: a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  message: string;

  @ApiProperty({
    description: 'Expiry timestamp (5 minutes from issuance)',
    example: '2025-05-19T14:00:00Z',
  })
  expiresAt: string;
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT access token (24h expiry)',
    example: 'eyJhbGciOiJIUzI1NiIs...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Token type',
    example: 'Bearer',
  })
  tokenType: string;

  @ApiProperty({
    description: 'Expiry in seconds',
    example: 86400,
  })
  expiresIn: number;

  @ApiProperty({
    description: 'User wallet address',
    example: 'GBR3C4O...',
  })
  wallet: string;
}
