-- ============================================
-- IMPORT CLIENTS - From CSV export
-- ============================================

INSERT INTO clients (user_email, business_name, category, contact_name, phone, email, notes) VALUES
('lastcall.me@hotmail.com', 'Adam''s Detailing & Coatings', 'Automotive Detailing', NULL, '7162453854', 'adamattack417@gmail.com', NULL),
('lastcall.me@hotmail.com', 'Aerial Insight LLC', 'Drones', NULL, '12315572870', 'aerialinsightllc@protonmail.com', NULL),
('lastcall.me@hotmail.com', 'Animal Kingdom Veterinary Hospital', 'Veterinary Hospital', 'Teresa Rupert', '7167735242', 'vet@animalkingdomvet.com', NULL),
('lastcall.me@hotmail.com', 'Babcock Development', 'Home Remodeling', 'Austin Castillo', '7163823351', 'info@babcock-development.com', NULL),
('lastcall.me@hotmail.com', 'Black Gold Sealer', 'Blacktop Sealing', 'John Faso', '7165984019', 'fasotwo@gmail.com', NULL),
('lastcall.me@hotmail.com', 'Brass Ring Web Solutions', 'Marketing', 'Logan Benjamin', '7167752622', 'logan@wnythrive.com', NULL),
('lastcall.me@hotmail.com', 'CasXteriors', 'Home Remodeling', NULL, '7168604423', 'casxteriors@yahoo.com', NULL),
('lastcall.me@hotmail.com', 'Cloudberry Cafe', 'Restaurant', 'Camille Caraglin', '7163390154', 'camille@cloudberry.com', NULL),
('lastcall.me@hotmail.com', 'Cross Controls & Electric', 'Electrician', 'Jordan Benoit', '7167737720', 'gifc286benoit@gmail.com', NULL),
('lastcall.me@hotmail.com', 'Dana''s Stylin Pets', 'Pet Care', NULL, '7169902881', 'danasstylinpets@gmail.com', NULL),
('lastcall.me@hotmail.com', 'Darnley Equipment Rental', 'Equipment Rental', NULL, '7165503805', 'darnleyequipmentrental@yahoo.com', NULL),
('lastcall.me@hotmail.com', 'Dowd Battery - Justin Dowd', 'Retail', NULL, '7169121721', 'justin@dowdbattery.com', NULL),
('lastcall.me@hotmail.com', 'Dr. Michael Muto Chiropractic', 'Chiropractor', NULL, NULL, 'km.moran1973@gmail.com', NULL),
('lastcall.me@hotmail.com', 'Fabrics Direct 4 You', 'Boating', 'Nick Kingston', '7167252147', 'paypal@diyseatskins.com', NULL),
('lastcall.me@hotmail.com', 'GGC Inc.', 'Gutter Cleaning', NULL, '7163001480', 'ggc.inc@yahoo.com', NULL),
('lastcall.me@hotmail.com', 'GI Waste Management', 'Septic Cleaning', NULL, '7167831085', 'info@giwaste.com', NULL),
('lastcall.me@hotmail.com', 'GK Property Maintenance LLC', 'Landscaping', 'Gary West', '7165536883', 'gkpmwny@gmail.com', NULL),
('lastcall.me@hotmail.com', 'Homes by Kodiak, Inc.', 'Home Construction', NULL, NULL, 'ddesimone@grand-island.ny.us', NULL),
('lastcall.me@hotmail.com', 'Island Pets and Feed, Inc', 'Retail', 'Samantha', '7167731150', 'islandpets07@yahoo.com', NULL),
('lastcall.me@hotmail.com', 'Jack & Jill Community School', 'Daycare', NULL, '7167757003', 'kellianncarney@gmail.com', NULL),
('lastcall.me@hotmail.com', 'JBay Exterior Soft Pressure Washing', 'Power washing', 'James Koslowski', '7166283288', 'jameswk23@gmail.com', NULL),
('lastcall.me@hotmail.com', 'Leaf, Stone & Steel', 'Retail', NULL, '7168676598', 'carmen@leafstoneandsteel.com', NULL),
('lastcall.me@hotmail.com', 'LeBoeuf Shoppe', 'Retail', NULL, '7162078308', 'joe@leboeufshoppe.com', NULL),
('lastcall.me@hotmail.com', 'Legendary Landscaping', 'Landscaping', NULL, '7169841827', NULL, NULL),
('lastcall.me@hotmail.com', 'Local Crafters Construction', 'Home Remodeling', NULL, '7169092910', 'info@localcraftersllc.com', NULL),
('lastcall.me@hotmail.com', 'Mark''s Island Tree Service', 'Tree Service', NULL, '7165360686', 'marksislandtreeservice@roadrunner.com', NULL),
('lastcall.me@hotmail.com', 'OCC Concrete Corp', 'Concrete', 'Tony Caruana', '7162397774', 'tony@occconcretecorp.com', NULL),
('lastcall.me@hotmail.com', 'Pure Sky Energy', 'Solar Farm', 'Janet Janzen', '4158548567', 'janet.janzen@pureskyenergy.com', NULL),
('lastcall.me@hotmail.com', 'Roofologists', 'Roofing', 'Andre', '7168702574', 'roofologists@gmail.com', NULL),
('lastcall.me@hotmail.com', 'The Park Buffalo', 'Fitness', 'Liz Goss', '7169094621', 'liz@theparkbuffalo.com', NULL),
('lastcall.me@hotmail.com', 'Trilogy Physical Therapy', 'Physical Therapy', NULL, '7169090407', 'jessica.robins@mytrilogy.org', NULL);

-- Verify import
SELECT COUNT(*) as total_clients FROM clients WHERE user_email = 'lastcall.me@hotmail.com';
SELECT business_name, category, contact_name FROM clients WHERE user_email = 'lastcall.me@hotmail.com' ORDER BY business_name;
