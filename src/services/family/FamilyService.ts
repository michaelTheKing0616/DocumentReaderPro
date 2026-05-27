import { getSupabaseClient, isSupabaseConfigured } from '../storage/supabase/SupabaseClient';
import { logger } from '../logger/Logger';

export interface FamilyLink {
  id: string;
  parentId: string;
  childId?: string;
  inviteCode?: string;
  childDisplayName?: string;
  status: 'pending' | 'active' | 'revoked';
  createdAt: string;
  acceptedAt?: string;
  expiresAt?: string;
}

export interface LinkedChildStats {
  childId: string;
  childDisplayName?: string;
  points: number;
  level: number;
  streaks: { current: number; longest: number; lastDate: string };
  badges: unknown[];
  avgComprehension30d: number;
  sessions7d: number;
}

export interface ReadingAssignment {
  id: string;
  parentId: string;
  childId: string;
  title: string;
  documentId?: string;
  instructions?: string;
  dueDate?: string;
  status: 'assigned' | 'in_progress' | 'completed';
  createdAt: string;
}

const INVITE_TTL_DAYS = 7;

function generateInviteCode(): string {
  const segment = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RA-${segment()}-${segment()}`;
}

class FamilyService {
  isAvailable(): boolean {
    return isSupabaseConfigured() && getSupabaseClient() !== null;
  }

  async createInvite(parentId: string, childDisplayName?: string): Promise<FamilyLink> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Family links require Supabase');
    }

    const inviteCode = generateInviteCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

    const { data, error } = await supabase
      .from('family_links')
      .insert({
        parent_id: parentId,
        invite_code: inviteCode,
        child_display_name: childDisplayName ?? null,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select('*')
      .single();

    if (error || !data) {
      throw error ?? new Error('Failed to create invite');
    }

    logger.info('Family invite created', { parentId, inviteCode });
    return this.mapLink(data);
  }

  async acceptInvite(inviteCode: string, childId: string): Promise<FamilyLink> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Family links require Supabase');
    }

    const normalized = inviteCode.trim().toUpperCase();
    const { data: pending, error: fetchError } = await supabase
      .from('family_links')
      .select('*')
      .eq('invite_code', normalized)
      .eq('status', 'pending')
      .maybeSingle();

    if (fetchError || !pending) {
      throw new Error('Invalid or expired invite code');
    }

    if (pending.expires_at && new Date(pending.expires_at) < new Date()) {
      throw new Error('Invite code has expired');
    }

    const { data, error } = await supabase
      .from('family_links')
      .update({
        child_id: childId,
        status: 'active',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', pending.id)
      .select('*')
      .single();

    if (error || !data) {
      throw error ?? new Error('Failed to accept invite');
    }

    logger.info('Family invite accepted', { childId, inviteCode: normalized });
    return this.mapLink(data);
  }

  async getLinkedChildren(parentId: string): Promise<LinkedChildStats[]> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('linked_child_stats')
      .select('*')
      .eq('parent_id', parentId);

    if (error) {
      logger.warn('linked_child_stats query failed', { message: error.message });
      return [];
    }

    return (data ?? []).map((row) => ({
      childId: row.child_id,
      childDisplayName: row.child_display_name ?? undefined,
      points: row.points ?? 0,
      level: row.level ?? 1,
      streaks: (row.streaks as LinkedChildStats['streaks']) ?? {
        current: 0,
        longest: 0,
        lastDate: '',
      },
      badges: (row.badges as unknown[]) ?? [],
      avgComprehension30d: Number(row.avg_comprehension_30d ?? 0),
      sessions7d: Number(row.sessions_7d ?? 0),
    }));
  }

  async getPendingInvites(parentId: string): Promise<FamilyLink[]> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('family_links')
      .select('*')
      .eq('parent_id', parentId)
      .eq('status', 'pending');

    if (error) {
      throw error;
    }
    return (data ?? []).map((row) => this.mapLink(row));
  }

  async createAssignment(
    parentId: string,
    childId: string,
    input: {
      title: string;
      documentId?: string;
      instructions?: string;
      dueDate?: Date;
    }
  ): Promise<ReadingAssignment> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Assignments require Supabase');
    }

    const { data: link } = await supabase
      .from('family_links')
      .select('id')
      .eq('parent_id', parentId)
      .eq('child_id', childId)
      .eq('status', 'active')
      .maybeSingle();

    if (!link) {
      throw new Error('Child is not linked to this parent account');
    }

    const { data, error } = await supabase
      .from('reading_assignments')
      .insert({
        parent_id: parentId,
        child_id: childId,
        title: input.title,
        document_id: input.documentId ?? null,
        instructions: input.instructions ?? null,
        due_date: input.dueDate?.toISOString() ?? null,
        status: 'assigned',
      })
      .select('*')
      .single();

    if (error || !data) {
      throw error ?? new Error('Failed to create assignment');
    }

    return this.mapAssignment(data);
  }

  async getAssignmentsForParent(parentId: string): Promise<ReadingAssignment[]> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('reading_assignments')
      .select('*')
      .eq('parent_id', parentId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }
    return (data ?? []).map((row) => this.mapAssignment(row));
  }

  async getAssignmentsForChild(childId: string): Promise<ReadingAssignment[]> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('reading_assignments')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }
    return (data ?? []).map((row) => this.mapAssignment(row));
  }

  private mapLink(row: Record<string, unknown>): FamilyLink {
    return {
      id: String(row.id),
      parentId: String(row.parent_id),
      childId: row.child_id ? String(row.child_id) : undefined,
      inviteCode: row.invite_code ? String(row.invite_code) : undefined,
      childDisplayName: row.child_display_name ? String(row.child_display_name) : undefined,
      status: row.status as FamilyLink['status'],
      createdAt: String(row.created_at),
      acceptedAt: row.accepted_at ? String(row.accepted_at) : undefined,
      expiresAt: row.expires_at ? String(row.expires_at) : undefined,
    };
  }

  private mapAssignment(row: Record<string, unknown>): ReadingAssignment {
    return {
      id: String(row.id),
      parentId: String(row.parent_id),
      childId: String(row.child_id),
      title: String(row.title),
      documentId: row.document_id ? String(row.document_id) : undefined,
      instructions: row.instructions ? String(row.instructions) : undefined,
      dueDate: row.due_date ? String(row.due_date) : undefined,
      status: row.status as ReadingAssignment['status'],
      createdAt: String(row.created_at),
    };
  }
}

export default new FamilyService();
