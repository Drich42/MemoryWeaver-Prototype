-- Diagnostic Script: Hunt down RLS leaks

-- 1. Check if RLS is actually enabled on the table (Row Level Security)
SELECT relname, relrowsecurity, relforcerowsecurity 
FROM pg_class 
WHERE relname IN ('persons', 'memories', 'collections', 'person_relationships');

-- 2. Print out ALL active policies just to be 100% sure the bad ones are gone
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- 3. Check for any table grants given to the 'anon' or 'public' role 
-- (Sometimes a global GRANT can bypass RLS if not careful, though RLS should still filter rows)
SELECT grantee, privilege_type, table_name 
FROM information_schema.role_table_grants 
WHERE grantee IN ('anon', 'public') AND table_schema = 'public';
