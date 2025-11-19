-- Find Duplicate Clients in Supabase
-- Run this first to identify which clients are duplicated
-- This will show you the duplicate business names and their client IDs

DO $$
DECLARE
    v_user_email TEXT := 'rcall@10kpostcards.com';
    client_data JSONB;
    client_id TEXT;
    business_name TEXT;
    client_info JSONB;
BEGIN
    -- Get the current clients data
    SELECT data INTO client_data
    FROM app_data
    WHERE user_email = v_user_email
    AND data_type = 'clients';

    IF client_data IS NULL THEN
        RAISE EXCEPTION 'No client data found for user: %', v_user_email;
    END IF;

    RAISE NOTICE '🔍 Searching for duplicate clients...';
    RAISE NOTICE '';

    -- Create a temporary table to track business names
    CREATE TEMP TABLE IF NOT EXISTS business_name_counts (
        business_name TEXT,
        count INTEGER,
        client_ids TEXT[]
    );

    -- Count occurrences of each business name
    FOR client_id IN SELECT jsonb_object_keys(client_data->'clients') LOOP
        business_name := client_data->'clients'->client_id->>'businessName';

        -- Check if this business name already exists in our temp table
        IF EXISTS (SELECT 1 FROM business_name_counts WHERE business_name_counts.business_name = business_name) THEN
            -- Increment count and add client_id
            UPDATE business_name_counts
            SET
                count = count + 1,
                client_ids = array_append(client_ids, client_id)
            WHERE business_name_counts.business_name = business_name;
        ELSE
            -- First occurrence
            INSERT INTO business_name_counts (business_name, count, client_ids)
            VALUES (business_name, 1, ARRAY[client_id]);
        END IF;
    END LOOP;

    -- Show duplicates
    RAISE NOTICE '📊 DUPLICATE CLIENTS FOUND:';
    RAISE NOTICE '';

    FOR business_name IN
        SELECT business_name_counts.business_name
        FROM business_name_counts
        WHERE count > 1
        ORDER BY business_name_counts.business_name
    LOOP
        DECLARE
            duplicate_ids TEXT[];
            duplicate_id TEXT;
        BEGIN
            SELECT client_ids INTO duplicate_ids
            FROM business_name_counts
            WHERE business_name_counts.business_name = business_name;

            RAISE NOTICE '🔴 Business: %', business_name;
            RAISE NOTICE '   Found % entries with IDs:', array_length(duplicate_ids, 1);

            FOREACH duplicate_id IN ARRAY duplicate_ids LOOP
                client_info := client_data->'clients'->duplicate_id;

                RAISE NOTICE '   - ID: %', duplicate_id;
                RAISE NOTICE '     Email: %', client_info->'contact'->>'email';
                RAISE NOTICE '     Phone: %', client_info->'contact'->>'phone';
                RAISE NOTICE '     Contact Name: %', client_info->'contact'->>'name';
                RAISE NOTICE '     Town: %', client_info->>'town';
                RAISE NOTICE '     Has Interactions: %',
                    CASE
                        WHEN jsonb_array_length(COALESCE(client_info->'interactions', '[]'::jsonb)) > 0
                        THEN 'Yes (' || jsonb_array_length(client_info->'interactions') || ')'
                        ELSE 'No'
                    END;
                RAISE NOTICE '';
            END LOOP;
            RAISE NOTICE '---';
        END;
    END LOOP;

    -- Summary
    DECLARE
        duplicate_count INTEGER;
    BEGIN
        SELECT COUNT(*) INTO duplicate_count
        FROM business_name_counts
        WHERE count > 1;

        RAISE NOTICE '';
        RAISE NOTICE '✅ Scan Complete!';
        RAISE NOTICE 'Found % business names with duplicates', duplicate_count;
    END;

    -- Clean up
    DROP TABLE IF EXISTS business_name_counts;
END $$;
