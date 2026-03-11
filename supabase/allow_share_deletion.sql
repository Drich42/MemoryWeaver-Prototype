-- Fix Share Cascade Deletion Block
-- If a memory or collection has been shared, deleting it triggers a CASCADE delete on the `shares` table.
-- Because the `shares` table had no explicit DELETE policy, RLS blocked the cascade,
-- which in turn aborted the deletion of the parent memory or collection.

ALTER TABLE shares ENABLE ROW LEVEL SECURITY;

-- Drop existing delete policy if it exists (for idempotency)
DROP POLICY IF EXISTS "Users can delete relevant shares" ON shares;
DROP POLICY IF EXISTS "Enable public delete for shares" ON shares;

-- Allow users to delete a share if they are the sender
CREATE POLICY "Users can delete relevant shares" ON shares
    FOR DELETE USING (
        auth.uid() = sender_id OR recipient_email = (auth.jwt() ->> 'email')
    );

NOTIFY pgrst, 'reload schema';
