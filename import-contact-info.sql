-- Import Contact Info from CSV to Supabase
-- This script updates client contact information in the app_data table
-- Run this in the Supabase SQL Editor

-- Step 1: Create a temporary table with contact data from CSV
CREATE TEMP TABLE contact_imports (
    business_name TEXT,
    email TEXT,
    phone TEXT,
    contact_name TEXT
);

-- Step 2: Insert contact data from CSV
-- Column B = Business Name, Column C = Contact Person, Column D = Email, Column E = Phone
INSERT INTO contact_imports (business_name, email, phone, contact_name) VALUES
('Adam''s Detailing & Coatings', 'adamattack417@gmail.com', '+17162453854', NULL),
('Aerial Insight LLC', 'aerialinsightllc@protonmail.com', '+12315572870', NULL),
('Animal Kingdom Veterinary Hospital', 'vet@animalkingdomvet.com', '+17167735242', 'Teresa Rupert'),
('Babcock Development', 'info@babcock-development.com', '+17163823351', 'Austin Castillo'),
('Black Gold Sealer', 'fasotwo@gmail.com', '+17165984019', 'John Faso'),
('Brass Ring Web Solutions', 'logan@wnythrive.com', '+17167752622', 'Logan Benjamin'),
('CasXteriors', 'casxteriors@yahoo.com', '+17168604423', NULL),
('Cloudberry Cafe', 'camille@cloudberry.com', '+17163390154', 'Camille Caraglin'),
('Cross Controls & Electric', 'gifc286benoit@gmail.com', '+17167737720', 'Jordan Benoit'),
('Dana''s Stylin Pets', 'danasstylinpets@gmail.com', '+17169902881', NULL),
('Darnley Equipment Rental', 'darnleyequipmentrental@yahoo.com', '+17165503805', NULL),
('Dowd Battery - Justin Dowd', 'justin@dowdbattery.com', '+17169121721', NULL),
('Dr. Michael Muto Chiropractic', 'km.moran1973@gmail.com', NULL, NULL),
('Fabrics Direct 4 You', 'paypal@diyseatskins.com', '+17167252147', 'Nick Kingston'),
('GGC Inc.', 'ggc.inc@yahoo.com', '+17163001480', NULL),
('GI Waste Management', 'info@giwaste.com', '+17167831085', NULL),
('GK Property Maintenance LLC', 'gkpmwny@gmail.com', '+17165536883', 'Gary West'),
('Homes by Kodiak, Inc.', 'ddesimone@grand-island.ny.us', NULL, NULL),
('Island Pets and Feed, Inc', 'islandpets07@yahoo.com', '+17167731150', 'Samantha'),
('Jack & Jill Community School', 'kellianncarney@gmail.com', '+17167757003', NULL),
('JBay Exterior Soft Pressure Washing', 'jameswk23@gmail.com', '+17166283288', 'James Koslowski'),
('Leaf, Stone & Steel', 'carmen@leafstoneandsteel.com', '+17168676598', NULL),
('LeBoeuf Shoppe', 'joe@leboeufshoppe.com', '+17162078308', NULL),
('Legendary Landscaping', NULL, '+17169841827', NULL),
('Local Crafters Construction LLC', 'info@localcraftersllc.com', '+17169092910', NULL),
('Mark''s Island Tree Service', 'marksislandtreeservice@roadrunner.com', '+17165360686', NULL),
('OCC Concrete Corp', 'tony@occconcretecorp.com', '+17162397774', 'Tony Caruana'),
('Pure Sky Energy', 'janet.janzen@pureskyenergy.com', '+14158548567', 'Janet Janzen'),
('Roofologists', 'roofologists@gmail.com', '+17168702574', 'Andre'),
('The Park Buffalo', 'liz@theparkbuffalo.com', '+17169094621', 'Liz Goss'),
('Trilogy Physical Therapy', 'jessica.robins@mytrilogy.org', '+17169090407', 'Jessica Robins');

-- Step 3: Update client contact info in app_data table
-- This uses PostgreSQL's JSON manipulation functions
DO $$
DECLARE
    v_user_email TEXT := 'rcall@10kpostcards.com'; -- Your actual email from Supabase
    client_data JSONB;
    contact_row RECORD;
    client_id TEXT;
    updated_count INTEGER := 0;
    not_found_count INTEGER := 0;
BEGIN
    -- Get the current clients data
    SELECT data INTO client_data
    FROM app_data
    WHERE user_email = v_user_email
    AND data_type = 'clients';

    IF client_data IS NULL THEN
        RAISE EXCEPTION 'No client data found for user: %', v_user_email;
    END IF;

    RAISE NOTICE 'Starting contact info import...';

    -- Loop through each contact import
    FOR contact_row IN SELECT * FROM contact_imports LOOP
        -- Flag to track if we found a match
        DECLARE
            found BOOLEAN := FALSE;
        BEGIN
            -- Loop through each client in the JSON data
            FOR client_id IN SELECT jsonb_object_keys(client_data->'clients') LOOP
                -- Check if business name matches (case-insensitive)
                IF LOWER(client_data->'clients'->client_id->>'businessName') = LOWER(contact_row.business_name) THEN
                    found := TRUE;

                    RAISE NOTICE 'Updating: %', contact_row.business_name;

                    -- Ensure contact object exists
                    IF client_data->'clients'->client_id->'contact' IS NULL THEN
                        client_data := jsonb_set(
                            client_data,
                            ARRAY['clients', client_id, 'contact'],
                            '{}'::jsonb
                        );
                    END IF;

                    -- Update email if provided
                    IF contact_row.email IS NOT NULL THEN
                        client_data := jsonb_set(
                            client_data,
                            ARRAY['clients', client_id, 'contact', 'email'],
                            to_jsonb(contact_row.email)
                        );
                    END IF;

                    -- Update phone if provided
                    IF contact_row.phone IS NOT NULL THEN
                        client_data := jsonb_set(
                            client_data,
                            ARRAY['clients', client_id, 'contact', 'phone'],
                            to_jsonb(contact_row.phone)
                        );
                    END IF;

                    -- Update contact name if provided
                    IF contact_row.contact_name IS NOT NULL THEN
                        client_data := jsonb_set(
                            client_data,
                            ARRAY['clients', client_id, 'contact', 'name'],
                            to_jsonb(contact_row.contact_name)
                        );
                    END IF;

                    updated_count := updated_count + 1;
                    EXIT; -- Stop searching once we find a match
                END IF;
            END LOOP;

            IF NOT found THEN
                RAISE NOTICE 'NOT FOUND: %', contact_row.business_name;
                not_found_count := not_found_count + 1;
            END IF;
        END;
    END LOOP;

    -- Update the app_data table with modified client data
    UPDATE app_data
    SET
        data = client_data,
        updated_at = NOW()
    WHERE user_email = v_user_email
    AND data_type = 'clients';

    RAISE NOTICE '✅ Import Complete!';
    RAISE NOTICE 'Updated: % clients', updated_count;
    RAISE NOTICE 'Not found: % clients', not_found_count;
END $$;

-- Step 4: Clean up temporary table
DROP TABLE contact_imports;

-- Step 5: Verify the updates
-- Run this to see a sample of updated contacts:
SELECT
    user_email,
    jsonb_pretty(
        jsonb_build_object(
            'client', value->'businessName',
            'email', value->'contact'->'email',
            'phone', value->'contact'->'phone',
            'contactName', value->'contact'->'name'
        )
    ) as contact_info
FROM app_data,
    jsonb_each(data->'clients')
WHERE data_type = 'clients'
AND user_email = 'rcall@10kpostcards.com'
AND value->'contact'->'email' IS NOT NULL
LIMIT 10;
