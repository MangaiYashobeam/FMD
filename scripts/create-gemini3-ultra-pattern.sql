-- ============================================
-- FBM-UltraSPEED Gemini3 v2 - MAXIMUM SPEED Pattern
-- ============================================
-- Optimizations:
-- 1. ALL typing actions → dump (instant paste)
-- 2. ALL wait actions → removed or minimized to 50ms
-- 3. ALL delays → removed
-- 4. Retry count = 1 (fail fast)
-- 5. Timeout = 8000ms (aggressive)
-- ============================================

-- Step 1: Delete old corrupted pattern if exists
DELETE FROM injection_patterns 
WHERE name IN ('FBM-UltraSPEED v1 Gemini3', 'FBM-UltraSpeed')
AND container_id = (SELECT id FROM injection_containers WHERE name = 'IAI Soldiers USM' LIMIT 1);

-- Step 2: Ensure USM container exists
INSERT INTO injection_containers (
  id, name, description, category, icon, color,
  is_active, is_default, priority,
  config, metadata, created_by, created_at, updated_at
) VALUES (
  'usm-container-gemini3',
  'IAI Soldiers USM',
  'Ultra Speed Mode container - Gemini3 optimized patterns for instant execution',
  'fbm', '⚡', '#FFD700',
  true, false, 200,
  '{"ultraSpeedOnly": true, "dumpMode": true, "maxExecutionTime": 10000}'::jsonb,
  '{"version": "3.0.0", "engine": "gemini3", "optimization": "dump-paste"}'::jsonb,
  'system-gemini3', NOW(), NOW()
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  config = EXCLUDED.config,
  metadata = EXCLUDED.metadata,
  priority = EXCLUDED.priority,
  is_active = true,
  updated_at = NOW();

-- Step 3: Create the OPTIMIZED Gemini3 pattern with hardcoded workflow
INSERT INTO injection_patterns (
  id, container_id, name, description,
  code, code_type, version,
  is_default, is_active, priority, weight,
  timeout, retry_count, failure_action,
  pre_conditions, post_actions,
  total_executions, success_count, failure_count, avg_execution_time,
  tags, metadata, created_by, created_at, updated_at
)
SELECT
  'gemini3-ultra-' || gen_random_uuid()::text,
  (SELECT id FROM injection_containers WHERE name = 'IAI Soldiers USM' LIMIT 1),
  'FBM-Gemini3-Ultra',
  'Maximum speed pattern: All typing = dump (paste). No waits. Instant execution. For established fingerprints only.',
  jsonb_build_object(
    'name', 'FBM-Gemini3-Ultra',
    'version', '3.0.0',
    'engine', 'gemini3',
    'dumpMode', true,
    'speedMultiplier', 100,
    'workflow', jsonb_build_array(
      -- Navigation
      jsonb_build_object('action', 'navigate', 'url', 'https://www.facebook.com/marketplace/create/vehicle', 'timeout', 5000),
      
      -- Title (dump)
      jsonb_build_object('action', 'dump', 'selector', '[aria-label*="Title"], [name="title"], input[placeholder*="title" i]', 'field', 'title'),
      
      -- Price (dump)
      jsonb_build_object('action', 'dump', 'selector', '[aria-label*="Price"], [name="price"], input[placeholder*="price" i]', 'field', 'price'),
      
      -- Year dropdown
      jsonb_build_object('action', 'select', 'fieldType', 'year', 'field', 'year'),
      
      -- Make dropdown  
      jsonb_build_object('action', 'select', 'fieldType', 'make', 'field', 'make'),
      
      -- Model dropdown
      jsonb_build_object('action', 'select', 'fieldType', 'model', 'field', 'model'),
      
      -- Mileage (dump)
      jsonb_build_object('action', 'dump', 'selector', '[aria-label*="Mileage"], [aria-label*="Miles"], [name="mileage"]', 'field', 'mileage'),
      
      -- Transmission dropdown
      jsonb_build_object('action', 'select', 'fieldType', 'transmission', 'field', 'transmission'),
      
      -- Fuel type dropdown
      jsonb_build_object('action', 'select', 'fieldType', 'fuelType', 'field', 'fuelType'),
      
      -- Body style dropdown
      jsonb_build_object('action', 'select', 'fieldType', 'bodyStyle', 'field', 'bodyStyle'),
      
      -- Exterior color dropdown
      jsonb_build_object('action', 'select', 'fieldType', 'exteriorColor', 'field', 'exteriorColor'),
      
      -- Interior color dropdown
      jsonb_build_object('action', 'select', 'fieldType', 'interiorColor', 'field', 'interiorColor'),
      
      -- Description (dump - instant)
      jsonb_build_object('action', 'dump', 'selector', '[aria-label*="Description"], textarea[name="description"], [contenteditable="true"]', 'field', 'description'),
      
      -- Photo upload
      jsonb_build_object('action', 'upload_photos', 'selector', 'input[type="file"]', 'field', 'photos'),
      
      -- Location (dump)
      jsonb_build_object('action', 'dump', 'selector', '[aria-label*="Location"], [name="location"]', 'field', 'location'),
      
      -- Submit
      jsonb_build_object('action', 'click', 'selector', '[aria-label="Publish"], [aria-label="Next"], button[type="submit"]', 'final', true)
    )
  )::text,
  'json',
  '3.0.0',
  true,   -- Is default
  true,   -- Is active
  300,    -- Highest priority
  150,    -- Highest weight
  8000,   -- 8s timeout (very aggressive)
  1,      -- Fail fast
  'skip', -- Skip on failure, don't retry
  '[]'::jsonb,
  '[]'::jsonb,
  0, 0, 0, 0,
  ARRAY['gemini3', 'ultra-speed', 'dump-mode', 'maximum-speed', 'no-wait'],
  jsonb_build_object(
    'engine', 'gemini3',
    'speedMultiplier', 100,
    'dumpMode', true,
    'noWaits', true,
    'optimizedFor', 'established-fingerprint',
    'securityLevel', 'maximum',
    'version', '3.0.0',
    'createdAt', NOW()::text
  ),
  'system-gemini3',
  NOW(),
  NOW()
ON CONFLICT (container_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  code = EXCLUDED.code,
  metadata = EXCLUDED.metadata,
  priority = EXCLUDED.priority,
  weight = EXCLUDED.weight,
  timeout = EXCLUDED.timeout,
  retry_count = EXCLUDED.retry_count,
  version = EXCLUDED.version,
  is_default = true,
  is_active = true,
  updated_at = NOW();

-- Step 4: Disable all other patterns in USM container  
UPDATE injection_patterns 
SET is_default = false 
WHERE container_id = (SELECT id FROM injection_containers WHERE name = 'IAI Soldiers USM' LIMIT 1)
AND name != 'FBM-Gemini3-Ultra';

-- Step 5: Verify
SELECT 
  c.name as container,
  p.name as pattern,
  p.is_active,
  p.is_default,
  p.priority,
  p.weight,
  p.timeout,
  (p.metadata->>'speedMultiplier')::text as speed,
  (p.metadata->>'dumpMode')::text as dump_mode
FROM injection_containers c
JOIN injection_patterns p ON p.container_id = c.id
WHERE c.name = 'IAI Soldiers USM'
ORDER BY p.priority DESC;
