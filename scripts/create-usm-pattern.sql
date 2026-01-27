-- ============================================
-- IAI Soldiers USM (Ultra Speed Mode) Setup
-- Creates the USM container and FBM-UltraSpeed pattern
-- ============================================

-- 1. Create the USM Container
INSERT INTO injection_containers (
  id,
  name,
  description,
  category,
  icon,
  color,
  is_active,
  is_default,
  priority,
  config,
  metadata,
  created_by,
  created_at,
  updated_at
) VALUES (
  'usm-container-' || gen_random_uuid()::text,
  'IAI Soldiers USM',
  'Ultra Speed Mode container - Verified fast patterns for Chrome Extension IAI with established browser fingerprints. Hot-swap picks exclusively from this container when Ultra Speed Mode is activated.',
  'fbm',
  '⚡',
  '#FFD700',
  true,
  false,
  100,
  '{"ultraSpeedOnly": true, "minSuccessRate": 0.8, "maxExecutionTime": 30000}'::jsonb,
  '{"version": "1.0.0", "createdFor": "USM", "description": "Ultra Speed Mode patterns with 3x faster execution"}'::jsonb,
  'system',
  NOW(),
  NOW()
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  config = EXCLUDED.config,
  metadata = EXCLUDED.metadata,
  updated_at = NOW()
RETURNING id;

-- 2. Clone FBM-Official-P1 as FBM-UltraSpeed with 3x speed
-- First get the USM container ID
WITH usm_container AS (
  SELECT id FROM injection_containers WHERE name = 'IAI Soldiers USM'
),
original_pattern AS (
  SELECT * FROM injection_patterns WHERE name = 'FBM-Official-P1'
)
INSERT INTO injection_patterns (
  id,
  container_id,
  name,
  description,
  code,
  code_type,
  version,
  is_default,
  is_active,
  priority,
  weight,
  timeout,
  retry_count,
  failure_action,
  pre_conditions,
  post_actions,
  total_executions,
  success_count,
  failure_count,
  avg_execution_time,
  tags,
  metadata,
  created_by,
  created_at,
  updated_at
)
SELECT
  'usm-pattern-' || gen_random_uuid()::text,
  (SELECT id FROM usm_container),
  'FBM-UltraSpeed',
  'Ultra Speed pattern cloned from FBM-Official-P1 with 3x faster execution. Optimized for Chrome Extension IAI with established browser fingerprints that require fewer Facebook verification delays.',
  -- Transform the code JSON to reduce all timestamps by 3x
  (
    SELECT jsonb_set(
      op.code::jsonb,
      '{workflow}',
      (
        SELECT jsonb_agg(
          CASE 
            WHEN step ? 'timestamp' THEN
              jsonb_set(step, '{timestamp}', to_jsonb((step->>'timestamp')::int / 3))
            ELSE step
          END
        )
        FROM jsonb_array_elements(op.code::jsonb->'workflow') AS step
      )
    )::text
    FROM original_pattern op
  ),
  op.code_type,
  '1.0.0-ultra',
  true,  -- Is default for USM container
  true,
  100,   -- High priority
  100,   -- High weight
  15000, -- 15 second timeout (reduced from 30s)
  2,     -- Fewer retries needed
  'retry',
  '[]'::jsonb,
  '[]'::jsonb,
  0,
  0,
  0,
  0,
  ARRAY['ultra-speed', 'fbm', 'verified', 'fast'],
  jsonb_build_object(
    'clonedFrom', 'FBM-Official-P1',
    'speedMultiplier', 3,
    'optimizedFor', 'chrome-extension',
    'requiresEstablishedFingerprint', true,
    'version', '1.0.0',
    'createdAt', NOW()::text
  ),
  'system',
  NOW(),
  NOW()
FROM original_pattern op
ON CONFLICT (container_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  code = EXCLUDED.code,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- 3. Verify the setup
SELECT 
  c.name as container_name,
  c.id as container_id,
  p.name as pattern_name,
  p.id as pattern_id,
  p.is_active,
  p.is_default,
  p.weight,
  p.priority,
  (p.metadata->>'speedMultiplier')::text as speed_multiplier
FROM injection_containers c
LEFT JOIN injection_patterns p ON p.container_id = c.id
WHERE c.name = 'IAI Soldiers USM';
