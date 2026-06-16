import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Opaque refresh token issued by auth verify or refresh',
    example: 'vU8gr9wXc0zO6jIv...',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
