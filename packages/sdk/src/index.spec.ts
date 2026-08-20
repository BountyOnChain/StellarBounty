import {
  StellarBountyClient,
  StellarBountyApiError,
  paginate,
  type Bounty,
  type Paginated,
  type CreateBountyInput,
  type CreateSubmissionInput,
} from './index';

describe('StellarBountyClient', () => {
  let client: StellarBountyClient;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    client = new StellarBountyClient({ apiUrl: 'http://localhost:4000' });
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('authenticate', () => {
    it('calls getChallenge then verifyChallenge', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ nonce: 'abc123' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ accessToken: 'jwt-token' }) });

      const token = await client.authenticate('GABC...', async () => 'sig');
      expect(token).toBe('jwt-token');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('listBounties', () => {
    it('returns paginated bounties with rewardAmount as string', async () => {
      const bounty: Bounty = {
        id: 'b1',
        title: 'Test',
        description: 'Desc',
        rewardAmount: '10000000',
        deadline: null,
        status: 'open',
        ownerAddress: 'GOWNER',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      const paginated: Paginated<Bounty> = {
        data: [bounty],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        nextCursor: null,
      };

      // Set token manually
      (client as unknown as { token: string }).token = 'jwt';
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(paginated) });

      const result = await client.listBounties();
      expect(result.data[0].rewardAmount).toBe('10000000');
      expect(typeof result.data[0].rewardAmount).toBe('string');
      expect(result.data[0].ownerAddress).toBe('GOWNER');
    });

    it('passes query parameters correctly', async () => {
      (client as unknown as { token: string }).token = 'jwt';
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 }),
      });

      await client.listBounties({ status: 'open', owner: 'GOWNER', limit: 10 });
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('status=open');
      expect(url).toContain('owner=GOWNER');
      expect(url).toContain('limit=10');
    });
  });

  describe('getBounty', () => {
    it('fetches a single bounty by id', async () => {
      (client as unknown as { token: string }).token = 'jwt';
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'b1', title: 'T', rewardAmount: '500', ownerAddress: 'G', status: 'open' }),
      });

      const bounty = await client.getBounty('b1');
      expect(bounty.id).toBe('b1');
      expect(bounty.rewardAmount).toBe('500');
    });
  });

  describe('createBounty', () => {
    it('POSTs to /api/v1/bounties', async () => {
      (client as unknown as { token: string }).token = 'jwt';
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'new', title: 'T', rewardAmount: '1000', ownerAddress: 'G', status: 'open' }),
      });

      const input: CreateBountyInput = { title: 'T', description: 'D', rewardAmount: '1000', ownerAddress: 'G' };
      await client.createBounty(input);
      expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    });
  });

  describe('submitWork', () => {
    it('POSTs with link and notes', async () => {
      (client as unknown as { token: string }).token = 'jwt';
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 's1', bountyId: 'b1', link: 'https://pr.example', status: 'pending' }),
      });

      const input: CreateSubmissionInput = { link: 'https://pr.example', notes: 'LGTM' };
      await client.submitWork('b1', input);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.link).toBe('https://pr.example');
      expect(body.notes).toBe('LGTM');
    });
  });

  describe('approveSubmission', () => {
    it('calls PATCH on the approve endpoint', async () => {
      (client as unknown as { token: string }).token = 'jwt';
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 's1', status: 'approved' }),
      });

      await client.approveSubmission('b1', 's1');
      expect(fetchMock.mock.calls[0][0]).toContain('/submissions/s1/approve');
      expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
    });
  });

  describe('rejectSubmission', () => {
    it('calls PATCH on the reject endpoint', async () => {
      (client as unknown as { token: string }).token = 'jwt';
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 's1', status: 'rejected' }),
      });

      await client.rejectSubmission('b1', 's1');
      expect(fetchMock.mock.calls[0][0]).toContain('/submissions/s1/reject');
      expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
    });
  });

  describe('deleteBounty', () => {
    it('calls DELETE', async () => {
      (client as unknown as { token: string }).token = 'jwt';
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ deleted: true }) });

      const result = await client.deleteBounty('b1');
      expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
      expect(result.deleted).toBe(true);
    });
  });

  describe('restoreBounty', () => {
    it('calls PATCH /restore', async () => {
      (client as unknown as { token: string }).token = 'jwt';
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 'b1', status: 'open' }) });

      await client.restoreBounty('b1');
      expect(fetchMock.mock.calls[0][0]).toContain('/bounties/b1/restore');
    });
  });

  describe('saveBounty / unsaveBounty', () => {
    it('saveBounty calls POST /save', async () => {
      (client as unknown as { token: string }).token = 'jwt';
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 'sb1', bountyId: 'b1' }) });

      await client.saveBounty('b1');
      expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    });

    it('unsaveBounty calls DELETE /save', async () => {
      (client as unknown as { token: string }).token = 'jwt';
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ deleted: true }) });

      await client.unsaveBounty('b1');
      expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
    });
  });
});

describe('StellarBountyApiError', () => {
  it('carries statusCode and code', () => {
    const err = new StellarBountyApiError('Conflict', 409, 'BOUNTY_TITLE_TAKEN');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(StellarBountyApiError);
    expect(err.name).toBe('StellarBountyApiError');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('BOUNTY_TITLE_TAKEN');
  });

  it('throws StellarBountyApiError on 409 with code', async () => {
    const client = new StellarBountyClient({ apiUrl: 'http://localhost:4000' });
    (client as unknown as { token: string }).token = 'jwt';

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ error: { code: 'BOUNTY_TITLE_TAKEN' } }),
    });

    await expect(client.createBounty({
      title: 'T',
      description: 'D',
      rewardAmount: '1000',
      ownerAddress: 'G',
    })).rejects.toThrow(StellarBountyApiError);

    try {
      await client.createBounty({
        title: 'T',
        description: 'D',
        rewardAmount: '1000',
        ownerAddress: 'G',
      });
    } catch (err) {
      expect(err).toBeInstanceOf(StellarBountyApiError);
      expect((err as StellarBountyApiError).code).toBe('BOUNTY_TITLE_TAKEN');
      expect((err as StellarBountyApiError).statusCode).toBe(409);
    }
  });
});

describe('paginate', () => {
  it('iterates all pages and yields every item', async () => {
    const items = [
      { id: '1' },
      { id: '2' },
      { id: '3' },
      { id: '4' },
    ];

    const fetchPage = jest.fn()
      .mockResolvedValueOnce({
        data: items.slice(0, 2),
        total: 4,
        page: 1,
        pageSize: 2,
        totalPages: 2,
        nextCursor: '2',
      })
      .mockResolvedValueOnce({
        data: items.slice(2),
        total: 4,
        page: 2,
        pageSize: 2,
        totalPages: 2,
        nextCursor: null,
      });

    const collected: { id: string }[] = [];
    for await (const item of paginate<{ id: string }>(fetchPage)) {
      collected.push(item);
    }

    expect(collected).toHaveLength(4);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenCalledWith(null);
    expect(fetchPage).toHaveBeenCalledWith('2');
  });

  it('exits cleanly when nextCursor is null on first page', async () => {
    const fetchPage = jest.fn().mockResolvedValue({
      data: [{ id: '1' }],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      nextCursor: null,
    });

    const collected: { id: string }[] = [];
    for await (const item of paginate<{ id: string }>(fetchPage)) {
      collected.push(item);
    }

    expect(collected).toHaveLength(1);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
