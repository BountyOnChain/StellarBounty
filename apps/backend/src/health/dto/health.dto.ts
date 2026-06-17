import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, Min, IsOptional } from 'class-validator';

export class HealthResponseDto {
  @ApiProperty({
    description: 'Service status',
    example: 'ok',
    enum: ['ok', 'degraded', 'down'],
  })
  @IsEnum(['ok', 'degraded', 'down'])
  status!: string;

  @ApiProperty({
    description: 'Current server timestamp',
    example: '2025-05-19T12:00:00.000Z',
  })
  @IsString()
  timestamp!: string;

  @ApiProperty({
    description: 'Environment',
    example: 'development',
    enum: ['development', 'staging', 'production'],
  })
  @IsEnum(['development', 'staging', 'production'])
  environment!: string;

  @ApiProperty({
    description: 'Application version',
    example: '1.0.0',
  })
  @IsString()
  version!: string;

  @ApiProperty({
    description: 'Uptime in seconds',
    example: 3600,
  })
  @IsNumber()
  @Min(0)
  uptime!: number;

  @ApiProperty({
    description: 'Database connectivity status',
    example: 'connected',
    enum: ['connected', 'disconnected'],
  })
  @IsEnum(['connected', 'disconnected'])
  database!: string;

  @ApiProperty({
    description: 'Stellar RPC connectivity status',
    example: 'connected',
    enum: ['connected', 'disconnected', 'not_configured'],
    required: false,
  })
  @IsEnum(['connected', 'disconnected', 'not_configured'])
  @IsOptional()
  stellarRpc?: string;

  @ApiProperty({
    description: 'Soroban contract reachability status',
    example: 'reachable',
    enum: ['reachable', 'unreachable', 'not_configured'],
    required: false,
  })
  @IsEnum(['reachable', 'unreachable', 'not_configured'])
  @IsOptional()
  contract?: string;
}
