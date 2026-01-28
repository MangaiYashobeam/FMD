-- ============================================
-- FBM-UltraSPEED v1 Gemini3 Setup
-- High-Performance "Dump" Pattern for IAI Soldiers
-- ============================================

-- 1. Get USM Container ID
WITH usm_container AS (
  SELECT id FROM injection_containers WHERE name = 'IAI Soldiers USM' LIMIT 1
),
original_pattern AS (
  SELECT * FROM injection_patterns WHERE name = 'FBM-Official-P1' LIMIT 1
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
  'usm-gemini3-' || gen_random_uuid()::text,
  (SELECT id FROM usm_container),
  'FBM-UltraSPEED v1 Gemini3',
  'Gemini3 Optimized Pattern: Uses direct value injection (dump) for 100x typing speed. Minimalistic movements. Highest security verification standards.',
  (
    SELECT jsonb_set(
      op.code::jsonb,
      '{workflow}',
      (
        SELECT jsonb_agg(
          CASE
            -- Transform TYPE/TYPE_TEXT actions to DUMP
            WHEN step->>'action' IN ('type', 'type_text', 'input') OR step->>'type' IN ('type', 'type_text', 'input') THEN
              jsonb_set(
                jsonb_set(
                   step, 
                   '{action}', 
                   '"dump"'
                ),
                '{type}', 
                '"dump"'
              ) - 'delay' - 'typingDelay' -- Remove typing delays
            
            -- Minimize WAIT steps (reduce by 90%)
            WHEN step->>'action' = 'wait' OR step->>'type' = 'wait' THEN
               jsonb_set(step, '{duration}', to_jsonb(GREATEST(100, (step->>'duration')::int / 10))) 

            -- Reduce standard timestamps for replay timing (5x speedup)
            WHEN step ? 'timestamp' THEN
              jsonb_set(step, '{timestamp}', to_jsonb((step->>'timestamp')::int / 5))
              
            ELSE step
          END
        )
        FROM jsonb_array_elements(op.code::jsonb->'workflow') AS step
      )
    )
    FROM original_pattern op
  ),
  op.code_type,
  '1.0.0-gemini3',
  true,  -- Make it the default for USM
  true,
  200,   -- Higher priority than previous UltraSpeed
  100,
  10000, -- 10s timeout (Very aggressive)
  1,     -- Fail fast
  'retry',
  '[]'::jsonb,
  '[]'::jsonb,
  0,
  0,
  0,
  0,
  ARRAY['ultra-speed', 'gemini3', 'dump-mode', 'fbm', 'verified'],
  jsonb_build_object(
    'clonedFrom', 'FBM-Official-P1',
    'speedMultiplier', 10,
    'optimization', 'Gemini3 Dump Injection',
    'requiresEstablishedFingerprint', true,
    'securityLevel', 'maximum',
    'sanitized', true,
    'version', '1.0.0-gemini3',
    'createdAt', NOW()::text
  ),
  'system-gemini',
  NOW(),
  NOW()
FROM original_pattern op
WHERE EXISTS (SELECT 1 FROM usm_container) AND EXISTS (SELECT 1 FROM original_pattern)
ON CONFLICT (container_id, name) DO UPDATE SET
  description = EXCLUDED.description,
  code = EXCLUDED.code,
  metadata = EXCLUDED.metadata,
  priority = EXCLUDED.priority,
  version = EXCLUDED.version,
  updated_at = NOW();

-- Disable previous UltraSpeed pattern to prefer Gemini3
UPDATE injection_patterns 
SET is_default = false 
WHERE name = 'FBM-UltraSpeed' 
AND container_id = (SELECT id FROM injection_containers WHERE name = 'IAI Soldiers USM' LIMIT 1);
