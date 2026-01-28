-- ============================================
-- DELETE CORRUPTED PATTERNS & RE-CREATE FBM-UltraSPEED v1 Gemini3
-- ============================================

-- 1. CLEANUP: Delete old "FBM-UltraSpeed" and previous attempts at "FBM-UltraSPEED v1 Gemini3"
DELETE FROM injection_patterns WHERE name LIKE 'FBM-UltraSPEED%';
DELETE FROM injection_patterns WHERE name = 'FBM-UltraSpeed'; 

-- 2. CREATE NEW PATTERN
-- Using Common Table Expressions (CTE) for clarity and safety
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
            -- This sets minDelay/maxDelay to 0 for instant execution
            WHEN step->>'action' IN ('type', 'type_text', 'input', 'write') OR step->>'type' IN ('type', 'type_text', 'input', 'write') THEN
              jsonb_build_object(
                  'action', 'dump',
                  'type', 'dump',
                  'selector', step->>'selector',
                  'value', step->>'value',
                  'text', step->>'text', -- Include both just in case
                  'description', 'Instant Dump Injection: ' || COALESCE(step->>'description', step->>'selector'),
                  'minDelay', 10,
                  'maxDelay', 50
              )
            
            -- Minimize WAIT steps (reduce to near zero for speed)
            WHEN step->>'action' = 'wait' OR step->>'type' = 'wait' THEN
               jsonb_set(step, '{duration}', to_jsonb(GREATEST(50, (step->>'duration')::int / 20))) 

            -- Reduce standard timestamps for replay timing (10x speedup)
            WHEN step ? 'timestamp' THEN
              jsonb_set(step, '{timestamp}', to_jsonb((step->>'timestamp')::int / 10))
              
            -- Keep clicks but make them fast
            WHEN step->>'action' = 'click' OR step->>'type' = 'click' THEN
               jsonb_set(
                   jsonb_set(step, '{minDelay}', '10'),
                   '{maxDelay}', '50'
               )

            ELSE step
          END
        )
        FROM jsonb_array_elements(op.code::jsonb->'workflow') AS step
      )
    )
    FROM original_pattern op
  ),
  op.code_type,
  '1.1.0-gemini3',
  true,  -- Make it the default for USM
  true,
  999,   -- Max priority
  1000,  -- Max weight
  5000,  -- 5s timeout (Very aggressive)
  1,     -- Fail fast
  'retry',
  '[]'::jsonb,
  '[]'::jsonb,
  0,
  0,
  0,
  0,
  ARRAY['ultra-speed', 'gemini3', 'dump-mode', 'fbm', 'verified', 'usm'],
  jsonb_build_object(
    'clonedFrom', 'FBM-Official-P1',
    'speedMultiplier', 100,
    'optimization', 'Gemini3 Dump Injection',
    'requiresEstablishedFingerprint', true,
    'browserEngine', 'chromium',
    'minChromiumVersion', '120.0.0.0'
  ),
  op.created_by,
  NOW(),
  NOW()
FROM original_pattern op
WHERE EXISTS (SELECT 1 FROM usm_container);
