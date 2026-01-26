"use strict";
/**
 * Seed: DealersFace-FBM Injection Container & Pattern
 *
 * Creates the first injection container with the FBM training pattern
 * from train-IAI-v3.json
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const prisma = new client_1.PrismaClient();
async function seedInjectionFBM() {
    console.log('🧬 Seeding DealersFace-FBM Injection Container...');
    // Read the training JSON
    const trainingPath = path.join(__dirname, '../../train-IAI-v3.json');
    let trainingData = null;
    try {
        const rawData = fs.readFileSync(trainingPath, 'utf-8');
        trainingData = JSON.parse(rawData);
        console.log(`📖 Loaded training data: ${trainingData.events?.length || 0} events`);
    }
    catch (error) {
        console.error('❌ Could not load train-IAI-v3.json:', error);
        trainingData = { events: [], metadata: {}, mode: 'listing' };
    }
    // Create the container
    const container = await prisma.injectionContainer.upsert({
        where: { name: 'DealersFace-FBM' },
        update: {
            description: 'Facebook Marketplace Vehicle Listing Automation - Core IAI behavior patterns for posting vehicles to FBM',
            category: 'fbm_flow',
            icon: 'car',
            color: '#1877F2', // Facebook blue
            isActive: true,
            isDefault: true,
            priority: 100,
            config: {
                targetUrl: 'https://www.facebook.com/marketplace/create/vehicle',
                supportedModes: ['listing', 'edit', 'relist'],
                maxRetries: 3,
                cooldownMs: 2000,
                humanization: {
                    enabled: true,
                    typingDelayRange: [50, 150],
                    clickDelayRange: [200, 800],
                    scrollBehavior: 'smooth'
                }
            },
            metadata: {
                tags: ['FBM', 'Facebook', 'IAI', 'Vehicle', 'Listing'],
                version: '1.0.0',
                author: 'DealersFace',
                source: 'train-IAI-v3.json',
                trainingStats: {
                    totalEvents: trainingData.events?.length || 0,
                    duration: trainingData.duration || 0,
                    mode: trainingData.mode || 'listing'
                }
            },
            updatedAt: new Date()
        },
        create: {
            name: 'DealersFace-FBM',
            description: 'Facebook Marketplace Vehicle Listing Automation - Core IAI behavior patterns for posting vehicles to FBM',
            category: 'fbm_flow',
            icon: 'car',
            color: '#1877F2',
            isActive: true,
            isDefault: true,
            priority: 100,
            config: {
                targetUrl: 'https://www.facebook.com/marketplace/create/vehicle',
                supportedModes: ['listing', 'edit', 'relist'],
                maxRetries: 3,
                cooldownMs: 2000,
                humanization: {
                    enabled: true,
                    typingDelayRange: [50, 150],
                    clickDelayRange: [200, 800],
                    scrollBehavior: 'smooth'
                }
            },
            metadata: {
                tags: ['FBM', 'Facebook', 'IAI', 'Vehicle', 'Listing'],
                version: '1.0.0',
                author: 'DealersFace',
                source: 'train-IAI-v3.json',
                trainingStats: {
                    totalEvents: trainingData.events?.length || 0,
                    duration: trainingData.duration || 0,
                    mode: trainingData.mode || 'listing'
                }
            }
        }
    });
    console.log(`✅ Container created/updated: ${container.name} (${container.id})`);
    // Extract meaningful events from training data
    const meaningfulEvents = extractMeaningfulEvents(trainingData.events || []);
    // Create the FBM-v3-Core pattern with the training data
    const patternCode = {
        type: 'workflow',
        version: '3.0.0',
        name: 'FBM Vehicle Listing Flow',
        description: 'Complete vehicle listing workflow learned from IAI training session',
        // Training metadata
        training: {
            sessionId: trainingData.sessionId,
            recordedAt: trainingData.startTime,
            duration: trainingData.duration,
            eventCount: trainingData.events?.length || 0,
            mode: trainingData.mode,
            viewport: trainingData.metadata?.screenWidth
                ? { width: trainingData.metadata.screenWidth, height: trainingData.metadata.screenHeight }
                : null
        },
        // Extracted workflow steps
        workflow: meaningfulEvents,
        // Field mappings for vehicle data
        fieldMappings: {
            year: { selectors: ['input[aria-label*="Year"]', 'input[placeholder*="Year"]'], type: 'input' },
            make: { selectors: ['input[aria-label*="Make"]', '[aria-label*="Make"] input'], type: 'dropdown' },
            model: { selectors: ['input[aria-label*="Model"]', '[aria-label*="Model"] input'], type: 'dropdown' },
            price: { selectors: ['input[aria-label*="Price"]', 'input[placeholder*="Price"]'], type: 'input' },
            mileage: { selectors: ['input[aria-label*="Mileage"]', 'input[placeholder*="Mileage"]'], type: 'input' },
            vin: { selectors: ['input[aria-label*="VIN"]', 'input[placeholder*="VIN"]'], type: 'input' },
            title: { selectors: ['input[aria-label*="Title"]', 'input[placeholder*="Title"]'], type: 'input' },
            description: { selectors: ['textarea[aria-label*="Description"]', '[contenteditable="true"]'], type: 'contenteditable' },
            location: { selectors: ['input[aria-label*="Location"]', 'input[placeholder*="Location"]'], type: 'input' },
            transmission: { selectors: ['[aria-label*="Transmission"]', '[role="listbox"]'], type: 'dropdown' },
            fuelType: { selectors: ['[aria-label*="Fuel"]', '[role="listbox"]'], type: 'dropdown' },
            bodyStyle: { selectors: ['[aria-label*="Body"]', '[role="listbox"]'], type: 'dropdown' },
            condition: { selectors: ['[aria-label*="Condition"]', '[role="listbox"]'], type: 'dropdown' },
            color: { selectors: ['[aria-label*="Color"]', '[role="listbox"]'], type: 'dropdown' }
        },
        // Action handlers
        actions: {
            uploadPhotos: {
                trigger: 'input[type="file"]',
                fallback: '[aria-label*="photo"], [aria-label*="Photo"]',
                multiple: true
            },
            submitListing: {
                trigger: '[aria-label*="Publish"], button[type="submit"]',
                fallback: 'button:contains("Next"), button:contains("Publish")',
                confirmationWait: 5000
            }
        },
        // Error recovery patterns
        errorRecovery: {
            fieldNotFound: { action: 'scroll', retryAfter: 1000 },
            dropdownNotOpen: { action: 'click', retryAfter: 500 },
            uploadFailed: { action: 'retry', maxRetries: 3 },
            timeout: { action: 'refresh', maxRetries: 1 }
        }
    };
    const pattern = await prisma.injectionPattern.upsert({
        where: {
            containerId_name: {
                containerId: container.id,
                name: 'FBM-v3-Core'
            }
        },
        update: {
            description: 'Core FBM vehicle listing pattern trained from real user interactions',
            code: JSON.stringify(patternCode, null, 2),
            codeType: 'workflow',
            version: '3.0.0',
            isDefault: true,
            isActive: true,
            priority: 100,
            weight: 100,
            timeout: 120000, // 2 minutes for full listing flow
            retryCount: 3,
            failureAction: 'retry',
            preConditions: [
                { type: 'url', pattern: 'facebook.com/marketplace', required: true },
                { type: 'element', selector: '[aria-label*="Marketplace"]', required: false }
            ],
            postActions: [
                { type: 'screenshot', condition: 'always' },
                { type: 'log', level: 'info', message: 'Listing workflow completed' }
            ],
            tags: ['FBM', 'Facebook', 'IAI', 'Vehicle', 'Listing', 'Core', 'v3'],
            metadata: {
                trainedFrom: 'train-IAI-v3.json',
                eventCount: trainingData.events?.length || 0,
                extractedSteps: meaningfulEvents.length
            },
            updatedAt: new Date()
        },
        create: {
            containerId: container.id,
            name: 'FBM-v3-Core',
            description: 'Core FBM vehicle listing pattern trained from real user interactions',
            code: JSON.stringify(patternCode, null, 2),
            codeType: 'workflow',
            version: '3.0.0',
            isDefault: true,
            isActive: true,
            priority: 100,
            weight: 100,
            timeout: 120000,
            retryCount: 3,
            failureAction: 'retry',
            preConditions: [
                { type: 'url', pattern: 'facebook.com/marketplace', required: true },
                { type: 'element', selector: '[aria-label*="Marketplace"]', required: false }
            ],
            postActions: [
                { type: 'screenshot', condition: 'always' },
                { type: 'log', level: 'info', message: 'Listing workflow completed' }
            ],
            tags: ['FBM', 'Facebook', 'IAI', 'Vehicle', 'Listing', 'Core', 'v3'],
            metadata: {
                trainedFrom: 'train-IAI-v3.json',
                eventCount: trainingData.events?.length || 0,
                extractedSteps: meaningfulEvents.length
            }
        }
    });
    console.log(`✅ Pattern created/updated: ${pattern.name} (${pattern.id})`);
    console.log(`   - Events extracted: ${meaningfulEvents.length}`);
    console.log(`   - Tags: ${pattern.tags.join(', ')}`);
    return { container, pattern };
}
/**
 * Extract meaningful events from raw training data
 */
function extractMeaningfulEvents(events) {
    const meaningfulEvents = [];
    let stepNumber = 0;
    for (const event of events) {
        // Skip session events and non-interactive events
        if (event.type === 'sessionStart' || event.type === 'sessionEnd')
            continue;
        if (event.type === 'scroll' && !event.element)
            continue;
        // Extract meaningful clicks and inputs
        if (event.type === 'click' || event.type === 'input' || event.type === 'select') {
            stepNumber++;
            const step = {
                step: stepNumber,
                type: event.type,
                timestamp: event.relativeTime,
                element: {
                    tagName: event.element?.tagName,
                    ariaLabel: event.element?.ariaLabel,
                    placeholder: event.element?.placeholder,
                    role: event.element?.role,
                    className: event.element?.className?.substring(0, 100), // Truncate long class names
                    selectors: event.element?.selectors || []
                }
            };
            // Add value for input events
            if (event.type === 'input' && event.value) {
                step.valueType = detectValueType(event.value);
                step.valuePlaceholder = `{{${step.valueType}}}`;
            }
            // Add selection for select events
            if (event.type === 'select' && event.selectedOption) {
                step.selectedOption = event.selectedOption;
            }
            // Add field type detection
            if (event.fieldType) {
                step.fieldType = event.fieldType;
            }
            // Mark important steps
            if (event.element?.ariaLabel?.includes('Publish') ||
                event.element?.ariaLabel?.includes('Next') ||
                event.element?.ariaLabel?.includes('Post')) {
                step.isSubmitAction = true;
            }
            meaningfulEvents.push(step);
        }
        // Include dropdown selections
        if (event.type === 'dropdownSelect' || event.type === 'listboxSelect') {
            stepNumber++;
            meaningfulEvents.push({
                step: stepNumber,
                type: 'select',
                timestamp: event.relativeTime,
                element: {
                    tagName: event.element?.tagName,
                    ariaLabel: event.element?.ariaLabel,
                    role: event.element?.role
                },
                selectedValue: event.selectedValue,
                selectedText: event.selectedText
            });
        }
    }
    return meaningfulEvents;
}
/**
 * Detect what type of value was entered (for templating)
 */
function detectValueType(value) {
    if (!value)
        return 'text';
    // Year pattern
    if (/^(19|20)\d{2}$/.test(value))
        return 'vehicle_year';
    // Price pattern
    if (/^\$?[\d,]+\.?\d*$/.test(value))
        return 'vehicle_price';
    // VIN pattern (17 chars)
    if (/^[A-HJ-NPR-Z0-9]{17}$/i.test(value))
        return 'vehicle_vin';
    // Mileage pattern
    if (/^[\d,]+\s*(miles?|mi)?$/i.test(value))
        return 'vehicle_mileage';
    // Phone number
    if (/^\+?[\d\s\-()]{10,}$/.test(value))
        return 'phone';
    // Email
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
        return 'email';
    // URL
    if (/^https?:\/\//i.test(value))
        return 'url';
    // Default
    return 'text';
}
// Run seed
seedInjectionFBM()
    .then(({ container, pattern }) => {
    console.log('\n🎉 Injection seed completed successfully!');
    console.log(`   Container: ${container.name}`);
    console.log(`   Pattern: ${pattern.name}`);
})
    .catch(console.error)
    .finally(() => prisma.$disconnect());
