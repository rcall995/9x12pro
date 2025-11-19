-- Remove Duplicate Clients from Supabase
-- This script keeps the client record with the most complete data
-- Run find-duplicate-clients.sql first to see what will be removed

DO $$
DECLARE
    v_user_email TEXT := 'rcall@10kpostcards.com';
    client_data JSONB;
    client_id TEXT;
    business_name TEXT;
    duplicate_ids TEXT[];
    best_id TEXT;
    current_id TEXT;
    best_score INTEGER;
    current_score INTEGER;
    removed_count INTEGER := 0;
BEGIN
    -- Get the current clients data
    SELECT data INTO client_data
    FROM app_data
    WHERE user_email = v_user_email
    AND data_type = 'clients';

    IF client_data IS NULL THEN
        RAISE EXCEPTION 'No client data found for user: %', v_user_email;
    END IF;

    RAISE NOTICE '🔵 Starting duplicate removal...';
    RAISE NOTICE '';

    -- Create temporary table to track business names
    CREATE TEMP TABLE IF NOT EXISTS business_name_groups (
        business_name TEXT,
        client_ids TEXT[]
    );

    -- Group client IDs by business name
    FOR client_id IN SELECT jsonb_object_keys(client_data->'clients') LOOP
        business_name := client_data->'clients'->client_id->>'businessName';

        IF EXISTS (SELECT 1 FROM business_name_groups WHERE business_name_groups.business_name = business_name) THEN
            UPDATE business_name_groups
            SET client_ids = array_append(client_ids, client_id)
            WHERE business_name_groups.business_name = business_name;
        ELSE
            INSERT INTO business_name_groups (business_name, client_ids)
            VALUES (business_name, ARRAY[client_id]);
        END IF;
    END LOOP;

    -- Process duplicates
    FOR business_name, duplicate_ids IN
        SELECT business_name_groups.business_name, business_name_groups.client_ids
        FROM business_name_groups
        WHERE array_length(client_ids, 1) > 1
    LOOP
        RAISE NOTICE '🔴 Processing duplicates for: %', business_name;

        -- Find the "best" client record to keep
        -- Score based on: has email (+3), has phone (+3), has contact name (+2), has interactions (+5), has address info (+1)
        best_id := NULL;
        best_score := -1;

        FOREACH current_id IN ARRAY duplicate_ids LOOP
            DECLARE
                client_info JSONB;
            BEGIN
                client_info := client_data->'clients'->current_id;
                current_score := 0;

                -- Score this client
                IF client_info->'contact'->>'email' IS NOT NULL AND client_info->'contact'->>'email' != '' THEN
                    current_score := current_score + 3;
                END IF;

                IF client_info->'contact'->>'phone' IS NOT NULL AND client_info->'contact'->>'phone' != '' THEN
                    current_score := current_score + 3;
                END IF;

                IF client_info->'contact'->>'name' IS NOT NULL AND client_info->'contact'->>'name' != '' THEN
                    current_score := current_score + 2;
                END IF;

                IF jsonb_array_length(COALESCE(client_info->'interactions', '[]'::jsonb)) > 0 THEN
                    current_score := current_score + 5;
                END IF;

                IF client_info->>'town' IS NOT NULL AND client_info->>'town' != '' THEN
                    current_score := current_score + 1;
                END IF;

                IF client_info->>'zipCode' IS NOT NULL AND client_info->>'zipCode' != '' THEN
                    current_score := current_score + 1;
                END IF;

                RAISE NOTICE '   ID % - Score: %', current_id, current_score;

                -- Keep the highest scoring record
                IF current_score > best_score THEN
                    best_score := current_score;
                    best_id := current_id;
                END IF;
            END;
        END LOOP;

        RAISE NOTICE '   ✅ KEEPING ID: % (Score: %)', best_id, best_score;

        -- Remove all other duplicates
        FOREACH current_id IN ARRAY duplicate_ids LOOP
            IF current_id != best_id THEN
                RAISE NOTICE '   ❌ REMOVING ID: %', current_id;

                -- Remove from JSONB
                client_data := jsonb_set(
                    client_data,
                    ARRAY['clients'],
                    (client_data->'clients') - current_id
                );

                removed_count := removed_count + 1;
            END IF;
        END LOOP;

        RAISE NOTICE '';
    END LOOP;

    -- Update the database
    IF removed_count > 0 THEN
        UPDATE app_data
        SET
            data = client_data,
            updated_at = NOW()
        WHERE user_email = v_user_email
        AND data_type = 'clients';

        RAISE NOTICE '✅ Cleanup Complete!';
        RAISE NOTICE 'Removed % duplicate client records', removed_count;
    ELSE
        RAISE NOTICE '✅ No duplicates found - database is clean!';
    END IF;

    -- Clean up
    DROP TABLE IF EXISTS business_name_groups;
END $$;
