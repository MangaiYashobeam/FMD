# CRITICAL: Super Admin Backup Info
# Generated: January 25, 2026

## VPS Server
- IP: 46.4.224.182
- SSH: root@46.4.224.182

## Super Admin Users
| ID | Email | First Name | Role |
|----|-------|------------|------|
| 63ae6e9d-76e6-495a-9907-7a1e16dba467 | admin@gadproductions.com | Admin | SUPER_ADMIN |
| b1463da1-3c38-4ac5-874d-32ec9b39ef26 | mangaiiyasamy1@icloud.com | Makara | SUPER_ADMIN |

## Account Owners
| ID | Email | First Name | Role |
|----|-------|------------|------|
| 7c89e310-275f-4c95-86da-c98be7ffc7e8 | jasobeam777@hotmail.com | Pabloas | ACCOUNT_OWNER |
| 2547f4a9-e5b7-4ac4-ba3a-02a45225f12e | reedharriswhips@gmail.com | Reed | ACCOUNT_OWNER |

## IIPC Whitelisted IPs (from .env)
- 46.4.224.182 (VPS Server)
- 86.40.131.65 (Admin)

## Database Connection
- Container: facemydealer-postgres-1
- User: facemydealer
- Database: facemydealer
- Access: `docker exec facemydealer-postgres-1 psql -U facemydealer -d facemydealer`

## To Restore Super Admin Access
If database is wiped, create user and run:
```sql
INSERT INTO users (id, email, password_hash, first_name, is_active, email_verified, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'admin@gadproductions.com',
  '$2a$10$[HASHED_PASSWORD]',  -- Use bcrypt hash
  'Admin',
  true,
  true,
  NOW(),
  NOW()
);

-- Then add to account_users with SUPER_ADMIN role
```
