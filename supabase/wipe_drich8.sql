-- Instructions: 
-- 1. Log into your Supabase Dashboard at https://supabase.com/dashboard/project/vperdrqmhxfuzfgumtjv
-- 2. Open the "SQL Editor" on the left navigation.
-- 3. Click "New Query" and paste the following code exactly as is.
-- 4. Click the green "Run" button.

DO $$ 
DECLARE
    target_user_id UUID;
BEGIN
    -- Attempt to find the user's UUID securely from the internal auth table
    SELECT id INTO target_user_id 
    FROM auth.users 
    WHERE email = 'drich8@vols.utk.edu' 
    LIMIT 1;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Could not find a user with email drich8@vols.utk.edu in auth.users';
    END IF;

    -- Delete all specific node types (relationships will cascade automatically)
    DELETE FROM public.memories WHERE uploader_id = target_user_id;
    DELETE FROM public.persons WHERE uploader_id = target_user_id;
    DELETE FROM public.collections WHERE uploader_id = target_user_id;

    RAISE NOTICE 'Successfully wiped all application data for drich8@vols.utk.edu (User ID: %). Their login will still work.', target_user_id;
END $$;
