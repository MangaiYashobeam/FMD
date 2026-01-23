-- Emergency Database Restore SQL
-- Run with: psql -U facemydealer -d facemydealer -f restore.sql

-- 1. Create main account
INSERT INTO accounts (id, name, dealership_name, subscription_status, is_active, created_at, updated_at)
VALUES (
  'd285d16f-6318-412e-81ef-dcd45fe09a73',
  'GAD Productions',
  'GAD Productions',
  'active',
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 2. Create admin user (password: Admin123! - bcrypt hash)
INSERT INTO users (id, email, password_hash, first_name, last_name, is_active, email_verified, created_at, updated_at)
VALUES (
  '63ae6e9d-76e6-495a-9907-7a1e16dba467',
  'admin@gadproductions.com',
  '$2a$10$rqUwOPY.Q5xPQxMqQGEqt.8F8wQZ4UxQnL8q7gL5YdJlQVY1xKzWG',
  'Admin',
  'User',
  true,
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 3. Link user to account as super admin
INSERT INTO account_users (id, account_id, user_id, role, is_primary, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'd285d16f-6318-412e-81ef-dcd45fe09a73',
  '63ae6e9d-76e6-495a-9907-7a1e16dba467',
  'SUPER_ADMIN',
  true,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- 4. Create subscription plans
INSERT INTO subscription_plans (id, name, description, price_monthly, price_yearly, features, max_vehicles, max_posts, max_accounts, is_active, created_at, updated_at)
VALUES
  ('plan_free', 'Free Trial', '14-day free trial', 0, 0, '["5 vehicles", "Basic posting", "Email support"]', 5, 10, 1, true, NOW(), NOW()),
  ('plan_starter', 'Starter', 'For small dealerships', 49.99, 499, '["25 vehicles", "Unlimited posting", "Priority support"]', 25, 100, 1, true, NOW(), NOW()),
  ('plan_professional', 'Professional', 'For growing dealerships', 99.99, 999, '["100 vehicles", "Advanced analytics", "Team access"]', 100, -1, 5, true, NOW(), NOW()),
  ('plan_enterprise', 'Enterprise', 'For large dealership groups', 299.99, 2999, '["Unlimited vehicles", "Custom integrations", "White label"]', -1, -1, -1, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 5. Create sample vehicles
INSERT INTO vehicles (id, stock_number, vin, year, make, model, trim, price, mileage, exterior_color, interior_color, transmission, drivetrain, fuel_type, engine, description, status, is_posted, account_id, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'STK001', '1HGCM82633A123456', 2024, 'Toyota', 'Camry', 'XSE', 32999, 5000, 'White', 'Black', 'Automatic', 'FWD', 'Gasoline', '2.5L 4-Cylinder', 'Beautiful 2024 Toyota Camry XSE!', 'available', false, 'd285d16f-6318-412e-81ef-dcd45fe09a73', NOW(), NOW()),
  (gen_random_uuid(), 'STK002', '5YJSA1E26MF123456', 2023, 'Tesla', 'Model S', 'Plaid', 89999, 12000, 'Red', 'White', 'Automatic', 'AWD', 'Electric', 'Tri Motor', 'Stunning Tesla Model S Plaid!', 'available', false, 'd285d16f-6318-412e-81ef-dcd45fe09a73', NOW(), NOW()),
  (gen_random_uuid(), 'STK003', 'WVWZZZ3CZWE123456', 2024, 'Volkswagen', 'ID.4', 'Pro S Plus', 52999, 2500, 'Blue', 'Gray', 'Automatic', 'AWD', 'Electric', 'Dual Motor', 'Family-friendly electric SUV!', 'available', false, 'd285d16f-6318-412e-81ef-dcd45fe09a73', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Done!
SELECT 'Database restored successfully!' as result;
SELECT COUNT(*) as users FROM users;
SELECT COUNT(*) as accounts FROM accounts;
SELECT COUNT(*) as vehicles FROM vehicles;
