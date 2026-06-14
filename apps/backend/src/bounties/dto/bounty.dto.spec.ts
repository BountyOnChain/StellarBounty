import { validate } from 'class-validator';
import { CreateBountyDto, MAX_REWARD_AMOUNT, UpdateBountyDto } from './bounty.dto';

describe('Bounty DTO rewardAmount validation', () => {
  function createValidDto(rewardAmount: string): CreateBountyDto {
    const dto = new CreateBountyDto();
    dto.title = 'Build the bounty page';
    dto.description = 'Create a working bounty page with wallet-gated submission.';
    dto.ownerAddress = 'GBU5ADWMR5EBCYGM6MLJVIEIGK2F536ZOMVHIVU2S4E6HF2T7UHTSXBB';
    dto.deadline = '2099-12-31T00:00:00.000Z';
    dto.rewardAmount = rewardAmount;
    return dto;
  }

  it('accepts a positive whole-number rewardAmount within the max', async () => {
    await expect(validate(createValidDto(MAX_REWARD_AMOUNT.toString()))).resolves.toHaveLength(0);
  });

  it.each(['0', '-1', '10.5', 'not-a-number', (MAX_REWARD_AMOUNT + 1n).toString()])(
    'rejects invalid rewardAmount %s',
    async (rewardAmount) => {
      const errors = await validate(createValidDto(rewardAmount));

      expect(errors.some((error) => error.property === 'rewardAmount')).toBe(true);
    },
  );

  it('validates optional update rewardAmount when present', async () => {
    const dto = new UpdateBountyDto();
    dto.rewardAmount = '-1';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'rewardAmount')).toBe(true);
  });

  it('rejects invalid ownerAddress values', async () => {
    const dto = createValidDto('10000000');
    dto.ownerAddress = 'not-a-stellar-address';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'ownerAddress')).toBe(true);
  });

  it('rejects deadlines that are not in the future', async () => {
    const dto = createValidDto('10000000');
    dto.deadline = '2000-01-01T00:00:00.000Z';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'deadline')).toBe(true);
  });

  it('validates optional update ownerAddress and deadline when present', async () => {
    const dto = new UpdateBountyDto();
    dto.ownerAddress = 'bad-address';
    dto.deadline = '2000-01-01T00:00:00.000Z';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'ownerAddress')).toBe(true);
    expect(errors.some((error) => error.property === 'deadline')).toBe(true);
  });
});
