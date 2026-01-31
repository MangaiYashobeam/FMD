"""
Anti-Detection Measures for Playwright Browsers
Helps avoid Facebook bot detection
"""
from typing import Dict, Any
from playwright.async_api import BrowserContext, Page
import structlog

logger = structlog.get_logger()


async def apply_stealth(context: BrowserContext):
    """
    Apply stealth measures to avoid bot detection
    
    This includes:
    - Hiding webdriver flag
    - Spoofing navigator properties
    - Masking automation indicators
    """
    
    # JavaScript to run on each new page
    stealth_js = """
    () => {
        // Override the webdriver property
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });
        
        // Override the plugins to look like a real browser
        Object.defineProperty(navigator, 'plugins', {
            get: () => [
                {
                    0: {type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format"},
                    description: "Portable Document Format",
                    filename: "internal-pdf-viewer",
                    length: 1,
                    name: "Chrome PDF Plugin"
                },
                {
                    0: {type: "application/pdf", suffixes: "pdf", description: "Portable Document Format"},
                    description: "Portable Document Format",
                    filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
                    length: 1,
                    name: "Chrome PDF Viewer"
                },
                {
                    0: {type: "application/x-nacl", suffixes: "", description: "Native Client Executable"},
                    1: {type: "application/x-pnacl", suffixes: "", description: "Portable Native Client Executable"},
                    description: "",
                    filename: "internal-nacl-plugin",
                    length: 2,
                    name: "Native Client"
                }
            ]
        });
        
        // Override languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en']
        });
        
        // Override platform
        Object.defineProperty(navigator, 'platform', {
            get: () => 'Win32'
        });
        
        // Override connection
        Object.defineProperty(navigator, 'connection', {
            get: () => ({
                effectiveType: '4g',
                rtt: 50,
                downlink: 10,
                saveData: false
            })
        });
        
        // Override hardware concurrency
        Object.defineProperty(navigator, 'hardwareConcurrency', {
            get: () => 8
        });
        
        // Override device memory
        Object.defineProperty(navigator, 'deviceMemory', {
            get: () => 8
        });
        
        // Override permissions query
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
        
        // Make chrome runtime appear real
        window.chrome = {
            runtime: {
                connect: () => {},
                sendMessage: () => {},
                onMessage: { addListener: () => {} }
            },
            loadTimes: () => ({
                requestTime: Date.now() / 1000 - 60,
                startLoadTime: Date.now() / 1000 - 59,
                commitLoadTime: Date.now() / 1000 - 58,
                finishDocumentLoadTime: Date.now() / 1000 - 57,
                finishLoadTime: Date.now() / 1000 - 56,
                firstPaintTime: Date.now() / 1000 - 55,
                firstPaintAfterLoadTime: 0,
                navigationType: 'Other'
            }),
            csi: () => ({
                startE: Date.now() - 1000,
                onloadT: Date.now() - 800,
                pageT: 1000,
                tran: 15
            })
        };
        
        // Override canvas fingerprinting
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function(type) {
            if (type === 'image/png') {
                const context = this.getContext('2d');
                const imageData = context.getImageData(0, 0, this.width, this.height);
                // Add subtle noise to prevent fingerprinting
                for (let i = 0; i < imageData.data.length; i += 4) {
                    imageData.data[i] = imageData.data[i] ^ (Math.random() * 2);
                }
                context.putImageData(imageData, 0, 0);
            }
            return originalToDataURL.apply(this, arguments);
        };
        
        // Override WebGL fingerprinting
        const getParameterOriginal = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) return 'Intel Open Source Technology Center';
            if (parameter === 37446) return 'Mesa DRI Intel(R) HD Graphics 620 (Kaby Lake GT2)';
            return getParameterOriginal.call(this, parameter);
        };
        
        // Override screen properties to be consistent
        Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
        Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
        Object.defineProperty(screen, 'width', { get: () => 1920 });
        Object.defineProperty(screen, 'height', { get: () => 1080 });
        Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
        Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
    }
    """
    
    # Add script to run on every new page
    # NOTE: add_init_script runs BEFORE page content loads, so it's not blocked by CSP
    await context.add_init_script(stealth_js)
    
    logger.debug("Stealth measures applied")


async def add_human_behavior(page: Page):
    """
    Add human-like behavior to page interactions
    
    NOTE: We avoid injecting inline scripts via add_script_tag() because
    Facebook's Content Security Policy (CSP) blocks inline scripts.
    Instead, we use Playwright's built-in methods for interactions.
    """
    # Human behavior is now handled via Playwright's built-in methods
    # in the marketplace.py and other files using:
    # - page.type() with delays
    # - random_delay() between actions  
    # - page.mouse.move() for mouse movements
    # - page.evaluate() for scroll actions (which doesn't inject inline scripts)
    
    # Add random mouse movements using Playwright's native methods
    import random
    try:
        for _ in range(random.randint(2, 4)):
            x = random.randint(100, 800)
            y = random.randint(100, 600)
            await page.mouse.move(x, y)
            await random_delay(50, 150)
    except Exception:
        pass  # Mouse move is optional, don't fail on it
    
    logger.debug("Human behavior simulation initialized")


async def random_delay(min_ms: int = 500, max_ms: int = 2000):
    """Add a random delay to simulate human timing"""
    import asyncio
    import random
    delay = random.randint(min_ms, max_ms) / 1000
    await asyncio.sleep(delay)


def generate_realistic_timing() -> Dict[str, Any]:
    """
    Generate realistic timing patterns for various actions
    Returns timing configurations that mimic human behavior
    """
    import random
    
    return {
        'typing': {
            'min_delay': random.randint(40, 80),
            'max_delay': random.randint(120, 200),
            'pause_probability': 0.1,
            'pause_duration': random.randint(500, 1500)
        },
        'clicking': {
            'pre_delay': random.randint(100, 300),
            'post_delay': random.randint(200, 500)
        },
        'scrolling': {
            'speed': random.uniform(0.8, 1.5),
            'pause_between_scrolls': random.randint(300, 800)
        },
        'page_viewing': {
            'min_time': random.randint(2000, 5000),
            'max_time': random.randint(8000, 15000)
        }
    }
