-- Family links, invite codes, and reading assignments

CREATE TABLE IF NOT EXISTS public.family_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code TEXT UNIQUE,
  child_display_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.reading_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  instructions TEXT,
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_links_parent ON public.family_links(parent_id);
CREATE INDEX IF NOT EXISTS idx_family_links_child ON public.family_links(child_id);
CREATE INDEX IF NOT EXISTS idx_family_links_invite ON public.family_links(invite_code);
CREATE INDEX IF NOT EXISTS idx_reading_assignments_child ON public.reading_assignments(child_id);

ALTER TABLE public.family_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_assignments ENABLE ROW LEVEL SECURITY;

-- Parents manage their own links
CREATE POLICY family_links_parent_select ON public.family_links
  FOR SELECT USING (auth.uid() = parent_id);

CREATE POLICY family_links_parent_insert ON public.family_links
  FOR INSERT WITH CHECK (auth.uid() = parent_id);

CREATE POLICY family_links_parent_update ON public.family_links
  FOR UPDATE USING (auth.uid() = parent_id);

CREATE POLICY family_links_parent_delete ON public.family_links
  FOR DELETE USING (auth.uid() = parent_id);

-- Children see links where they are the child
CREATE POLICY family_links_child_select ON public.family_links
  FOR SELECT USING (auth.uid() = child_id);

-- Children can accept invites (update pending row matching invite code)
CREATE POLICY family_links_child_accept ON public.family_links
  FOR UPDATE USING (
    status = 'pending'
    AND child_id IS NULL
    AND invite_code IS NOT NULL
  )
  WITH CHECK (auth.uid() = child_id);

-- Assignments: parents full access to their assignments
CREATE POLICY assignments_parent_all ON public.reading_assignments
  FOR ALL USING (auth.uid() = parent_id);

-- Children can read and update their own assignments
CREATE POLICY assignments_child_select ON public.reading_assignments
  FOR SELECT USING (auth.uid() = child_id);

CREATE POLICY assignments_child_update ON public.reading_assignments
  FOR UPDATE USING (auth.uid() = child_id);

-- Parents can read linked children's gamification and metrics via security definer view
CREATE OR REPLACE VIEW public.linked_child_stats AS
SELECT
  fl.parent_id,
  fl.child_id,
  fl.child_display_name,
  gs.points,
  gs.level,
  gs.streaks,
  gs.badges,
  (
    SELECT COALESCE(AVG(rm.comprehension_score), 0)
    FROM public.reading_metrics rm
    WHERE rm.user_id = fl.child_id
      AND rm.recorded_at > NOW() - INTERVAL '30 days'
  ) AS avg_comprehension_30d,
  (
    SELECT COUNT(*)
    FROM public.reading_metrics rm
    WHERE rm.user_id = fl.child_id
      AND rm.recorded_at > NOW() - INTERVAL '7 days'
  ) AS sessions_7d
FROM public.family_links fl
LEFT JOIN public.gamification_state gs ON gs.user_id = fl.child_id
WHERE fl.status = 'active' AND fl.child_id IS NOT NULL;

GRANT SELECT ON public.linked_child_stats TO authenticated;
