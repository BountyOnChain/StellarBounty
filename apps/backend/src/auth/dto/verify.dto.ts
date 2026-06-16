import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class VerifyDto {
  @ApiProperty({
    description: 'Stellar public key that signed the challenge nonce',
    example: 'GDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDXP4W5M2K2N7KDX',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: 'address must be a valid Stellar public key (starts with G, 56 characters)',
  })
  address!: string;

  @ApiProperty({
    description: 'Base64-encoded Stellar signature for the nonce',
    example: 'MEUCIQDZ9...example-signature...IDAQAB',
  })
  @IsString()
  @IsNotEmpty()
  signature!: string;

  @ApiProperty({
    description: 'Nonce returned by the challenge endpoint',
    example: 'f8a9f3d6a0e6c4b2f1d9c7a5e3b1d0c9f8a7e6d5c4b3a2918070605040302010',
  })
  @IsString()
  @IsNotEmpty()
  nonce!: string;
}

export class VerifyResponseDto {
  @ApiProperty({
    description: 'JWT access token for authenticated API requests',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Opaque refresh token used to rotate short-lived access tokens',
    example: 'vU8gr9wXc0zO6jIv...',
  })
  refreshToken!: string;
}
