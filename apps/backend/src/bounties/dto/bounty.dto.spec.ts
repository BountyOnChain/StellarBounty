import { validate } from 'class-validator';
import * as fc from 'fast-check';
import * as StellarSdk from '@stellar/stellar-sdk';
import { CreateBountyDto, MAX_REWARD_AMOUNT, UpdateBountyDto } from './bounty.dto';

describe('Bounty DTO rewardAmount validation', () => {
  const validOwnerAddress = StellarSdk.Keypair.random().publicKey();

  function createValidDto(rewardAmount: string): CreateBountyDto {
    const dto = new CreateBountyDto();
    dto.title = 'Build the bounty page';
    dto.description = 'Create a working bounty page with wallet-gated submission.';
    dto.ownerAddress = validOwnerAddress;
    dto.deadline = new Date(Date.now() + 86_400_000).toISOString();
    dto.rewardAmount = rewardAmount;
    return dto;
  }

  function validCreateBountyDtoArbitrary(): fc.Arbitrary<CreateBountyDto> {
    const publicKey = fc
      .uint8Array({ minLength: 32, maxLength: 32 })
      .map((seed) => StellarSdk.Keypair.fromRawEd25519Seed(Buffer.from(seed)).publicKey());
    const futureDeadline = fc
      .integer({ min: 1, max: 365 })
      .map((daysFromNow) => new Date(Date.now() + daysFromNow * 86_400_000).toISOString());

    return fc
      .record({
        title: fc.string({ minLength: 3, maxLength: 200 }),
        description: fc.string({ minLength: 10, maxLength: 500 }),
        rewardAmount: fc
          .bigInt({ min: 1n, max: MAX_REWARD_AMOUNT })
          .map((amount) => amount.toString()),
        ownerAddress: publicKey,
        tags: fc.option(fc.array(fc.string({ maxLength: 32 }), { maxLength: 5 }), {
          nil: undefined,
        }),
        deadline: fc.option(futureDeadline, { nil: undefined }),
      })
      .map((input) => Object.assign(new CreateBountyDto(), input));
  }

  it('accepts a positive whole-number rewardAmount within the max', async () => {
    await expect(validate(createValidDto(MAX_REWARD_AMOUNT.toString()))).resolves.toHaveLength(0);
  });

  it('accepts generated valid CreateBountyDto values', async () => {
    await fc.assert(
      fc.asyncProperty(validCreateBountyDtoArbitrary(), async (dto) => {
        await expect(validate(dto)).resolves.toHaveLength(0);
      }),
      { numRuns: 100 },
    );
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

  it.each(['GABC', 'not-a-stellar-key', StellarSdk.Keypair.random().secret()])(
    'rejects invalid ownerAddress %s',
    async (ownerAddress) => {
      const dto = createValidDto('10000000');
      dto.ownerAddress = ownerAddress;

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'ownerAddress')).toBe(true);
    },
  );

  it('validates optional update ownerAddress when present', async () => {
    const dto = new UpdateBountyDto();
    dto.ownerAddress = 'GABC';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'ownerAddress')).toBe(true);
  });

  it('rejects a past create deadline', async () => {
    const dto = createValidDto('10000000');
    dto.deadline = '2000-01-01T00:00:00.000Z';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'deadline')).toBe(true);
  });

  it('validates optional update deadline when present', async () => {
    const dto = new UpdateBountyDto();
    dto.deadline = '2000-01-01T00:00:00.000Z';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'deadline')).toBe(true);
  });
});
