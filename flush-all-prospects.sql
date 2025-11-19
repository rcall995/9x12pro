-- FLUSH ALL PROSPECTS FROM DATABASE (ONE-TIME CLEANUP)
-- This script removes ALL prospect data while keeping clients safe
-- Run this in Supabase SQL Editor

DO $flush_prospects$
DECLARE
    v_user_email TEXT := 'rcall@10kpostcards.com';
    current_data JSONB;
    clients_data JSONB;
    prospects_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting prospect flush for user: %', v_user_email;

    -- Get current data
    SELECT data INTO current_data
    FROM app_data
    WHERE user_email = v_user_email
    AND data_type = 'clients';

    IF current_data IS NULL THEN
        RAISE EXCEPTION 'No data found for user: %', v_user_email;
    END IF;

    -- Count current prospects
    IF current_data ? 'prospects' THEN
        SELECT jsonb_array_length(current_data->'prospects') INTO prospects_count;
        RAISE NOTICE 'Found % prospects to remove', prospects_count;
    ELSE
        RAISE NOTICE 'No prospects found';
    END IF;

    -- Start with clients only
    clients_data := jsonb_build_object(
        'clients', current_data->'clients'
    );

    -- Preserve other non-prospect data if it exists
    IF current_data ? 'currentMailerId' THEN
        clients_data := clients_data || jsonb_build_object('currentMailerId', current_data->'currentMailerId');
    END IF;

    IF current_data ? 'businessCategories' THEN
        clients_data := clients_data || jsonb_build_object('businessCategories', current_data->'businessCategories');
    END IF;

    -- Update the database with cleaned data
    UPDATE app_data
    SET
        data = clients_data,
        updated_at = NOW()
    WHERE user_email = v_user_email
    AND data_type = 'clients';

    RAISE NOTICE 'Prospect Flush Complete!';
    RAISE NOTICE 'Removed % prospects from pipeline', prospects_count;
    RAISE NOTICE 'All clients preserved safely!';

END $flush_prospects$;
