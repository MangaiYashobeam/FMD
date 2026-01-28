-- Create SMU-E2 pattern - HYPER SPEED (2x faster than SMU-E1)
-- Cloned from SMU-E1, optimized with halved delays and 2x type speed

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
  tags,
  metadata,
  created_at,
  updated_at
) VALUES (
  'smu-e2-' || gen_random_uuid()::text,
  'usm-container-e4e6989d-5116-4cd9-82c3-e4514be1871b',
  'SMU-E2',
  'HYPER SPEED v2 - 2x Faster than E1. Extreme optimization: halved delays, instant typing, minimal waits. Push the limits of automation speed.',
  '{
    "version": "2.0.0",
    "name": "SMU-E2",
    "mode": "HYPER_SPEED",
    "config": {
      "dumpMode": true,
      "speedMultiplier": 20,
      "minDelay": 2,
      "maxDelay": 25,
      "clickDelay": 15,
      "typeDelay": 0,
      "scrollDelay": 50,
      "retryAttempts": 3,
      "waitForElement": 1000,
      "waitForDropdown": 250
    },
    "sequence": [
      {
        "step": 1,
        "type": "navigate",
        "url": "https://www.facebook.com/marketplace/create/vehicle",
        "waitFor": 2000,
        "description": "Navigate to vehicle listing page"
      },
      {
        "step": 2,
        "type": "wait",
        "timeout": 750,
        "description": "Wait for page load"
      },
      {
        "step": 3,
        "type": "dump",
        "fieldType": "year",
        "valuePlaceholder": "{{year}}",
        "element": {
          "selectors": [
            "[aria-label*=\"Year\"] input",
            "input[aria-label*=\"Year\"]",
            "input[placeholder*=\"Year\"]"
          ]
        },
        "delay": 25
      },
      {
        "step": 4,
        "type": "click",
        "fieldType": "vehicleType",
        "element": {
          "selectors": [
            "[aria-label*=\"Vehicle type\"]",
            "div[role=\"combobox\"]"
          ]
        },
        "delay": 15
      },
      {
        "step": 5,
        "type": "selectOption",
        "fieldType": "vehicleType",
        "valuePlaceholder": "{{vehicleType}}",
        "fallback": "Car/Truck",
        "delay": 25
      },
      {
        "step": 6,
        "type": "click",
        "fieldType": "make",
        "element": {
          "selectors": [
            "[aria-label*=\"Make\"]",
            "input[aria-label*=\"Make\"]"
          ]
        },
        "delay": 15
      },
      {
        "step": 7,
        "type": "dump",
        "fieldType": "make",
        "valuePlaceholder": "{{make}}",
        "delay": 25
      },
      {
        "step": 8,
        "type": "selectOption",
        "fieldType": "make",
        "valuePlaceholder": "{{make}}",
        "delay": 50
      },
      {
        "step": 9,
        "type": "click",
        "fieldType": "model",
        "element": {
          "selectors": [
            "[aria-label*=\"Model\"]",
            "input[aria-label*=\"Model\"]"
          ]
        },
        "delay": 15
      },
      {
        "step": 10,
        "type": "dump",
        "fieldType": "model",
        "valuePlaceholder": "{{model}}",
        "delay": 25
      },
      {
        "step": 11,
        "type": "selectOption",
        "fieldType": "model",
        "valuePlaceholder": "{{model}}",
        "delay": 50
      },
      {
        "step": 12,
        "type": "dump",
        "fieldType": "price",
        "valuePlaceholder": "{{price}}",
        "element": {
          "selectors": [
            "[aria-label*=\"Price\"] input",
            "input[aria-label*=\"Price\"]",
            "input[placeholder*=\"Price\"]"
          ]
        },
        "delay": 25
      },
      {
        "step": 13,
        "type": "dump",
        "fieldType": "mileage",
        "valuePlaceholder": "{{mileage}}",
        "element": {
          "selectors": [
            "[aria-label*=\"Mileage\"] input",
            "input[aria-label*=\"Mileage\"]",
            "input[placeholder*=\"Mileage\"]"
          ]
        },
        "delay": 25
      },
      {
        "step": 14,
        "type": "click",
        "fieldType": "condition",
        "element": {
          "selectors": [
            "[aria-label*=\"Condition\"]",
            "div[role=\"combobox\"]"
          ]
        },
        "delay": 15
      },
      {
        "step": 15,
        "type": "selectOption",
        "fieldType": "condition",
        "valuePlaceholder": "{{condition}}",
        "fallback": "Good",
        "delay": 25
      },
      {
        "step": 16,
        "type": "click",
        "fieldType": "fuelType",
        "element": {
          "selectors": [
            "[aria-label*=\"Fuel\"]",
            "div[role=\"combobox\"]"
          ]
        },
        "delay": 15
      },
      {
        "step": 17,
        "type": "selectOption",
        "fieldType": "fuelType",
        "valuePlaceholder": "{{fuelType}}",
        "fallback": "Gasoline",
        "delay": 25
      },
      {
        "step": 18,
        "type": "click",
        "fieldType": "transmission",
        "element": {
          "selectors": [
            "[aria-label*=\"Transmission\"]",
            "div[role=\"combobox\"]"
          ]
        },
        "delay": 15
      },
      {
        "step": 19,
        "type": "selectOption",
        "fieldType": "transmission",
        "valuePlaceholder": "{{transmission}}",
        "fallback": "Automatic",
        "delay": 25
      },
      {
        "step": 20,
        "type": "click",
        "fieldType": "bodyStyle",
        "element": {
          "selectors": [
            "[aria-label*=\"Body\"]",
            "div[role=\"combobox\"]"
          ]
        },
        "delay": 15
      },
      {
        "step": 21,
        "type": "selectOption",
        "fieldType": "bodyStyle",
        "valuePlaceholder": "{{bodyStyle}}",
        "fallback": "Sedan",
        "delay": 25
      },
      {
        "step": 22,
        "type": "click",
        "fieldType": "cleanTitle",
        "element": {
          "selectors": [
            "[aria-label*=\"clean title\"]",
            "input[type=\"checkbox\"]"
          ]
        },
        "delay": 15
      },
      {
        "step": 23,
        "type": "dump",
        "fieldType": "vin",
        "valuePlaceholder": "{{vin}}",
        "element": {
          "selectors": [
            "[aria-label*=\"VIN\"] input",
            "input[aria-label*=\"VIN\"]"
          ]
        },
        "delay": 25,
        "optional": true
      },
      {
        "step": 24,
        "type": "click",
        "fieldType": "color",
        "element": {
          "selectors": [
            "[aria-label*=\"Color\"]",
            "[aria-label*=\"Exterior\"]"
          ]
        },
        "delay": 15
      },
      {
        "step": 25,
        "type": "selectOption",
        "fieldType": "color",
        "valuePlaceholder": "{{color}}",
        "fallback": "Black",
        "delay": 25
      },
      {
        "step": 26,
        "type": "dump",
        "fieldType": "description",
        "valuePlaceholder": "{{description}}",
        "element": {
          "selectors": [
            "[aria-label*=\"Description\"]",
            "[contenteditable=\"true\"]",
            "textarea"
          ]
        },
        "delay": 50
      },
      {
        "step": 27,
        "type": "dump",
        "fieldType": "location",
        "valuePlaceholder": "{{location}}",
        "element": {
          "selectors": [
            "[aria-label*=\"Location\"] input",
            "input[aria-label*=\"Location\"]"
          ]
        },
        "delay": 25
      },
      {
        "step": 28,
        "type": "selectOption",
        "fieldType": "location",
        "valuePlaceholder": "{{location}}",
        "delay": 100
      },
      {
        "step": 29,
        "type": "uploadPhotos",
        "fieldType": "photos",
        "valuePlaceholder": "{{photos}}",
        "element": {
          "selectors": [
            "input[type=\"file\"]",
            "[aria-label*=\"photo\"]"
          ]
        },
        "delay": 250
      },
      {
        "step": 30,
        "type": "wait",
        "timeout": 1000,
        "description": "Wait for photo upload"
      },
      {
        "step": 31,
        "type": "click",
        "fieldType": "next",
        "element": {
          "selectors": [
            "[aria-label=\"Next\"]",
            "button:has-text(\"Next\")",
            "div[role=\"button\"]:has-text(\"Next\")"
          ]
        },
        "delay": 50
      },
      {
        "step": 32,
        "type": "wait",
        "timeout": 500,
        "description": "Wait for next page"
      },
      {
        "step": 33,
        "type": "click",
        "fieldType": "publish",
        "element": {
          "selectors": [
            "[aria-label=\"Publish\"]",
            "button:has-text(\"Publish\")",
            "div[role=\"button\"]:has-text(\"Publish\")"
          ]
        },
        "delay": 50
      },
      {
        "step": 34,
        "type": "wait",
        "timeout": 1500,
        "description": "Wait for publish confirmation"
      }
    ],
    "fieldMappings": {
      "year": { "selectors": ["input[aria-label*=\"Year\"]"], "type": "dump" },
      "make": { "selectors": ["[aria-label*=\"Make\"]"], "type": "dropdown" },
      "model": { "selectors": ["[aria-label*=\"Model\"]"], "type": "dropdown" },
      "price": { "selectors": ["input[aria-label*=\"Price\"]"], "type": "dump" },
      "mileage": { "selectors": ["input[aria-label*=\"Mileage\"]"], "type": "dump" },
      "vin": { "selectors": ["input[aria-label*=\"VIN\"]"], "type": "dump" },
      "description": { "selectors": ["[contenteditable=\"true\"]"], "type": "dump" },
      "location": { "selectors": ["input[aria-label*=\"Location\"]"], "type": "dump" },
      "transmission": { "selectors": ["[aria-label*=\"Transmission\"]"], "type": "dropdown" },
      "fuelType": { "selectors": ["[aria-label*=\"Fuel\"]"], "type": "dropdown" },
      "bodyStyle": { "selectors": ["[aria-label*=\"Body\"]"], "type": "dropdown" },
      "condition": { "selectors": ["[aria-label*=\"Condition\"]"], "type": "dropdown" },
      "color": { "selectors": ["[aria-label*=\"Color\"]"], "type": "dropdown" }
    },
    "errorRecovery": {
      "fieldNotFound": { "action": "scroll", "retryAfter": 250 },
      "dropdownNotOpen": { "action": "click", "retryAfter": 100 },
      "timeout": { "action": "retry", "maxRetries": 2 }
    }
  }',
  'json',
  '2.0.0',
  false,
  true,
  90,
  100,
  60000,
  3,
  'retry',
  '[]'::jsonb,
  '[]'::jsonb,
  ARRAY['usm', 'hyper-speed', 'dump-mode', 'optimized', 'v2', '2x-fast'],
  '{"author": "system", "optimizedFor": "hyper-speed", "dumpMode": true, "speedMultiplier": 20, "clonedFrom": "SMU-E1"}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (container_id, name) DO UPDATE SET
  code = EXCLUDED.code,
  description = EXCLUDED.description,
  version = EXCLUDED.version,
  is_active = EXCLUDED.is_active,
  priority = EXCLUDED.priority,
  metadata = EXCLUDED.metadata,
  tags = EXCLUDED.tags,
  updated_at = NOW();
