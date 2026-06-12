import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { BountyCategory } from '../../entities/bounty.entity';

export class ListBountiesQueryDto {
  @IsOptional()
  @IsEnum(BountyCategory)
  category?: BountyCategory;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  tag?: string;
}
