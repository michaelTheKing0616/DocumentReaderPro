import FamilyService from '../src/services/family/FamilyService';

const mockSingle = jest.fn();
const mockMaybeSingle = jest.fn();
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();

function chainable() {
  const chain: Record<string, jest.Mock> = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    eq: mockEq,
    order: mockOrder,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
  };

  mockSelect.mockReturnValue(chain);
  mockInsert.mockReturnValue(chain);
  mockUpdate.mockReturnValue(chain);
  mockEq.mockReturnValue(chain);
  mockOrder.mockReturnValue(chain);

  return chain;
}

jest.mock('../src/services/storage/supabase/SupabaseClient', () => ({
  isSupabaseConfigured: jest.fn(() => true),
  getSupabaseClient: jest.fn(),
}));

import { getSupabaseClient, isSupabaseConfigured } from '../src/services/storage/supabase/SupabaseClient';

const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;
const mockIsSupabaseConfigured = isSupabaseConfigured as jest.MockedFunction<typeof isSupabaseConfigured>;

describe('FamilyService integration (mocked Supabase)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSupabaseConfigured.mockReturnValue(true);
    mockGetSupabaseClient.mockReturnValue({
      from: jest.fn(() => chainable()),
    } as never);
  });

  it('reports availability based on Supabase configuration', () => {
    mockIsSupabaseConfigured.mockReturnValue(false);
    mockGetSupabaseClient.mockReturnValue(null);
    expect(FamilyService.isAvailable()).toBe(false);

    mockIsSupabaseConfigured.mockReturnValue(true);
    mockGetSupabaseClient.mockReturnValue({ from: jest.fn() } as never);
    expect(FamilyService.isAvailable()).toBe(true);
  });

  it('creates a pending family invite', async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: 'link-1',
        parent_id: 'parent-1',
        invite_code: 'RA-ABCD-EFGH',
        child_display_name: 'Alex',
        status: 'pending',
        created_at: '2026-01-01T00:00:00.000Z',
        expires_at: '2026-01-08T00:00:00.000Z',
      },
      error: null,
    });

    const link = await FamilyService.createInvite('parent-1', 'Alex');

    expect(link.parentId).toBe('parent-1');
    expect(link.childDisplayName).toBe('Alex');
    expect(link.status).toBe('pending');
    expect(link.inviteCode).toMatch(/^RA-/);
    expect(mockInsert).toHaveBeenCalled();
  });

  it('accepts a valid invite code', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'link-1',
        parent_id: 'parent-1',
        invite_code: 'RA-TEST-CODE',
        status: 'pending',
        created_at: '2026-01-01T00:00:00.000Z',
        expires_at: '2026-12-31T00:00:00.000Z',
      },
      error: null,
    });

    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'link-1',
        parent_id: 'parent-1',
        child_id: 'child-1',
        invite_code: 'RA-TEST-CODE',
        status: 'active',
        created_at: '2026-01-01T00:00:00.000Z',
        accepted_at: '2026-01-02T00:00:00.000Z',
      },
      error: null,
    });

    const link = await FamilyService.acceptInvite('ra-test-code', 'child-1');

    expect(link.childId).toBe('child-1');
    expect(link.status).toBe('active');
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('returns empty linked children list when query fails', async () => {
    mockEq.mockReturnValue({
      eq: mockEq,
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockGetSupabaseClient.mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: { message: 'view missing' } }),
        }),
      })),
    } as never);

    const children = await FamilyService.getLinkedChildren('parent-1');
    expect(children).toEqual([]);
  });
});
