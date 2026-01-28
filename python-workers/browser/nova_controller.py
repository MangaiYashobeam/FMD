"""
Nova Browser Controller - Production-Grade AI Browser Control
============================================================

This module provides Nova (AI) with full control over Chromium browsers.
Each IAI instance gets a dedicated browser that Nova can control.

Key Features:
- Screenshot capture for vision analysis
- DOM inspection and extraction
- Natural language action execution
- Session persistence with encrypted cookies
- Anti-detection stealth measures
- Action history and state tracking

Architecture:
    Nova (AI) → NovaController → Playwright Browser → Facebook

Security:
- All actions are logged for audit
- Rate limiting to prevent detection
- Human-like delays and patterns
"""

import asyncio
import base64
import json
import time
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime
from enum import Enum
import hashlib
import random
import structlog

from playwright.async_api import Page, BrowserContext, ElementHandle, TimeoutError as PlaywrightTimeout

from core.config import get_settings
from browser.session import SessionManager
from browser.manager import BrowserInstance

logger = structlog.get_logger()


class ActionType(str, Enum):
    """Types of actions Nova can perform"""
    # Navigation
    NAVIGATE = "navigate"
    BACK = "back"
    FORWARD = "forward"
    REFRESH = "refresh"
    
    # Interaction
    CLICK = "click"
    TYPE = "type"
    CLEAR = "clear"
    SELECT = "select"
    HOVER = "hover"
    SCROLL = "scroll"
    PRESS_KEY = "press_key"
    
    # Data extraction
    SCREENSHOT = "screenshot"
    EXTRACT_HTML = "extract_html"
    EXTRACT_TEXT = "extract_text"
    EXTRACT_ELEMENTS = "extract_elements"
    GET_ATTRIBUTE = "get_attribute"
    
    # Advanced
    WAIT_FOR = "wait_for"
    EVALUATE = "evaluate"
    UPLOAD_FILE = "upload_file"
    DOWNLOAD = "download"
    
    # Facebook specific
    FB_SEND_MESSAGE = "fb_send_message"
    FB_CREATE_LISTING = "fb_create_listing"
    FB_GET_MESSAGES = "fb_get_messages"


class ActionResult:
    """Result of a Nova action"""
    def __init__(
        self,
        success: bool,
        action: str,
        data: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        duration_ms: int = 0,
        screenshot: Optional[str] = None
    ):
        self.success = success
        self.action = action
        self.data = data or {}
        self.error = error
        self.duration_ms = duration_ms
        self.screenshot = screenshot
        self.timestamp = datetime.utcnow().isoformat()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "action": self.action,
            "data": self.data,
            "error": self.error,
            "duration_ms": self.duration_ms,
            "screenshot": self.screenshot,
            "timestamp": self.timestamp
        }


class NovaController:
    """
    Production-grade controller for Nova AI to interact with browsers.
    
    This is the bridge between Nova's reasoning and real browser actions.
    
    Usage:
        controller = NovaController(browser_instance)
        
        # Take screenshot for vision analysis
        result = await controller.execute({
            "action": "screenshot",
            "full_page": False
        })
        
        # Click an element
        result = await controller.execute({
            "action": "click",
            "selector": "button[type='submit']"
        })
        
        # Type text
        result = await controller.execute({
            "action": "type",
            "selector": "input[name='price']",
            "value": "15000"
        })
    """
    
    def __init__(self, browser_instance: BrowserInstance):
        self.browser = browser_instance
        self.page: Page = browser_instance.page
        self.context: BrowserContext = browser_instance.context
        self.settings = get_settings()
        self.session_manager = SessionManager()
        
        # Action history for context
        self.action_history: List[Dict[str, Any]] = []
        self.max_history = 100
        
        # State tracking
        self.current_url = ""
        self.page_title = ""
        self.last_screenshot: Optional[str] = None
        self.last_action_time = 0
        
        # Rate limiting - 3X FASTER (USM Speed Mode)
        self.min_action_delay_ms = 33  # Minimum delay between actions (was 100ms, now ~33ms)
        self.human_delay_range = (16, 66)  # Random human-like delay (was 50-200ms, now ~16-66ms)
        
        # Facebook-specific selectors (can be updated via learning)
        self.fb_selectors = {
            "messenger_input": 'div[aria-label="Message"]',
            "send_button": 'div[aria-label="Press enter to send"]',
            "marketplace_create": '[aria-label="Create new listing"]',
            "message_thread": 'div[role="row"]',
        }
    
    async def execute(self, action_request: Dict[str, Any]) -> ActionResult:
        """
        Execute a Nova action on the browser.
        
        Args:
            action_request: Dict containing:
                - action: ActionType or string name
                - selector: CSS selector (for element interactions)
                - value: Value to input (for type actions)
                - url: URL to navigate to
                - options: Additional action-specific options
        
        Returns:
            ActionResult with success status, data, and optional screenshot
        """
        action = action_request.get("action", "").lower()
        start_time = time.time()
        
        # Apply human-like delay
        await self._human_delay()
        
        try:
            logger.info("Executing Nova action", 
                       action=action,
                       browser_id=self.browser.browser_id)
            
            # Route to appropriate handler
            handler = self._get_handler(action)
            if not handler:
                return ActionResult(
                    success=False,
                    action=action,
                    error=f"Unknown action: {action}"
                )
            
            result = await handler(action_request)
            
            # Calculate duration
            duration_ms = int((time.time() - start_time) * 1000)
            result.duration_ms = duration_ms
            
            # Record in history
            self._record_action(action_request, result)
            
            # Update state
            self.current_url = self.page.url
            try:
                self.page_title = await self.page.title()
            except:
                pass
            
            return result
            
        except PlaywrightTimeout as e:
            logger.warning("Action timeout", action=action, error=str(e))
            return ActionResult(
                success=False,
                action=action,
                error=f"Timeout: {str(e)}",
                duration_ms=int((time.time() - start_time) * 1000)
            )
        except Exception as e:
            logger.error("Action failed", action=action, error=str(e))
            return ActionResult(
                success=False,
                action=action,
                error=str(e),
                duration_ms=int((time.time() - start_time) * 1000)
            )
    
    def _get_handler(self, action: str):
        """Get the handler method for an action"""
        handlers = {
            # Navigation
            ActionType.NAVIGATE.value: self._navigate,
            ActionType.BACK.value: self._back,
            ActionType.FORWARD.value: self._forward,
            ActionType.REFRESH.value: self._refresh,
            
            # Interaction
            ActionType.CLICK.value: self._click,
            ActionType.TYPE.value: self._type,
            ActionType.CLEAR.value: self._clear,
            ActionType.SELECT.value: self._select,
            ActionType.HOVER.value: self._hover,
            ActionType.SCROLL.value: self._scroll,
            ActionType.PRESS_KEY.value: self._press_key,
            
            # Data extraction
            ActionType.SCREENSHOT.value: self._screenshot,
            ActionType.EXTRACT_HTML.value: self._extract_html,
            ActionType.EXTRACT_TEXT.value: self._extract_text,
            ActionType.EXTRACT_ELEMENTS.value: self._extract_elements,
            ActionType.GET_ATTRIBUTE.value: self._get_attribute,
            
            # Advanced
            ActionType.WAIT_FOR.value: self._wait_for,
            ActionType.EVALUATE.value: self._evaluate,
            ActionType.UPLOAD_FILE.value: self._upload_file,
            
            # Facebook specific
            ActionType.FB_SEND_MESSAGE.value: self._fb_send_message,
            ActionType.FB_CREATE_LISTING.value: self._fb_create_listing,
            ActionType.FB_GET_MESSAGES.value: self._fb_get_messages,
        }
        return handlers.get(action)
    
    # ========== Navigation Actions ==========
    
    async def _navigate(self, req: Dict) -> ActionResult:
        """Navigate to a URL"""
        url = req.get("url", "")
        wait_until = req.get("wait_until", "networkidle")
        
        if not url:
            return ActionResult(success=False, action="navigate", error="URL required")
        
        response = await self.page.goto(url, wait_until=wait_until)
        status = response.status if response else 0
        
        return ActionResult(
            success=200 <= status < 400 if status else True,
            action="navigate",
            data={
                "url": self.page.url,
                "status": status,
                "title": await self.page.title()
            }
        )
    
    async def _back(self, req: Dict) -> ActionResult:
        """Go back in history"""
        await self.page.go_back()
        return ActionResult(success=True, action="back", data={"url": self.page.url})
    
    async def _forward(self, req: Dict) -> ActionResult:
        """Go forward in history"""
        await self.page.go_forward()
        return ActionResult(success=True, action="forward", data={"url": self.page.url})
    
    async def _refresh(self, req: Dict) -> ActionResult:
        """Refresh the page"""
        await self.page.reload()
        return ActionResult(success=True, action="refresh", data={"url": self.page.url})
    
    # ========== Interaction Actions ==========
    
    async def _click(self, req: Dict) -> ActionResult:
        """Click an element"""
        selector = req.get("selector", "")
        timeout = req.get("timeout", 10000)
        
        if not selector:
            return ActionResult(success=False, action="click", error="Selector required")
        
        # Wait for element and click
        await self.page.wait_for_selector(selector, timeout=timeout)
        await self.page.click(selector)
        
        return ActionResult(
            success=True,
            action="click",
            data={"selector": selector, "url": self.page.url}
        )
    
    async def _type(self, req: Dict) -> ActionResult:
        """Type text into an element"""
        selector = req.get("selector", "")
        value = req.get("value", "")
        clear_first = req.get("clear_first", True)
        delay = req.get("delay", 10)  # ms between keystrokes - 3X FASTER (was 30ms)
        
        if not selector:
            return ActionResult(success=False, action="type", error="Selector required")
        
        await self.page.wait_for_selector(selector)
        
        if clear_first:
            await self.page.fill(selector, "")
        
        # Type with human-like delay
        await self.page.type(selector, value, delay=delay)
        
        return ActionResult(
            success=True,
            action="type",
            data={"selector": selector, "value_length": len(value)}
        )
    
    async def _clear(self, req: Dict) -> ActionResult:
        """Clear an input field"""
        selector = req.get("selector", "")
        if not selector:
            return ActionResult(success=False, action="clear", error="Selector required")
        
        await self.page.fill(selector, "")
        return ActionResult(success=True, action="clear", data={"selector": selector})
    
    async def _select(self, req: Dict) -> ActionResult:
        """Select option from dropdown"""
        selector = req.get("selector", "")
        value = req.get("value")
        label = req.get("label")
        
        if not selector:
            return ActionResult(success=False, action="select", error="Selector required")
        
        if value:
            await self.page.select_option(selector, value=value)
        elif label:
            await self.page.select_option(selector, label=label)
        else:
            return ActionResult(success=False, action="select", error="value or label required")
        
        return ActionResult(success=True, action="select", data={"selector": selector})
    
    async def _hover(self, req: Dict) -> ActionResult:
        """Hover over an element"""
        selector = req.get("selector", "")
        if not selector:
            return ActionResult(success=False, action="hover", error="Selector required")
        
        await self.page.hover(selector)
        return ActionResult(success=True, action="hover", data={"selector": selector})
    
    async def _scroll(self, req: Dict) -> ActionResult:
        """Scroll the page or element"""
        x = req.get("x", 0)
        y = req.get("y", 300)  # Default scroll down
        selector = req.get("selector")
        
        if selector:
            # Scroll element into view
            await self.page.evaluate(f'document.querySelector("{selector}")?.scrollIntoView()')
        else:
            await self.page.evaluate(f'window.scrollBy({x}, {y})')
        
        return ActionResult(success=True, action="scroll", data={"x": x, "y": y})
    
    async def _press_key(self, req: Dict) -> ActionResult:
        """Press a keyboard key"""
        key = req.get("key", "")
        if not key:
            return ActionResult(success=False, action="press_key", error="Key required")
        
        await self.page.keyboard.press(key)
        return ActionResult(success=True, action="press_key", data={"key": key})
    
    # ========== Data Extraction Actions ==========
    
    async def _screenshot(self, req: Dict) -> ActionResult:
        """Capture screenshot for vision analysis"""
        full_page = req.get("full_page", False)
        selector = req.get("selector")
        quality = req.get("quality", 80)
        
        if selector:
            # Screenshot specific element
            element = await self.page.query_selector(selector)
            if element:
                screenshot_bytes = await element.screenshot(type="jpeg", quality=quality)
            else:
                return ActionResult(success=False, action="screenshot", error=f"Element not found: {selector}")
        else:
            # Full page or viewport screenshot
            screenshot_bytes = await self.page.screenshot(
                type="jpeg",
                quality=quality,
                full_page=full_page
            )
        
        # Encode to base64
        screenshot_b64 = base64.b64encode(screenshot_bytes).decode("utf-8")
        self.last_screenshot = screenshot_b64
        
        return ActionResult(
            success=True,
            action="screenshot",
            data={
                "url": self.page.url,
                "title": await self.page.title(),
                "full_page": full_page,
                "size": len(screenshot_bytes)
            },
            screenshot=screenshot_b64
        )
    
    async def _extract_html(self, req: Dict) -> ActionResult:
        """Extract HTML content"""
        selector = req.get("selector", "body")
        include_scripts = req.get("include_scripts", False)
        
        if selector == "full":
            html = await self.page.content()
        else:
            element = await self.page.query_selector(selector)
            if element:
                html = await element.inner_html()
            else:
                return ActionResult(success=False, action="extract_html", error=f"Element not found: {selector}")
        
        # Optionally strip scripts for cleaner analysis
        if not include_scripts:
            import re
            html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
        
        return ActionResult(
            success=True,
            action="extract_html",
            data={
                "html": html,
                "length": len(html),
                "selector": selector
            }
        )
    
    async def _extract_text(self, req: Dict) -> ActionResult:
        """Extract text content"""
        selector = req.get("selector", "body")
        
        element = await self.page.query_selector(selector)
        if element:
            text = await element.inner_text()
        else:
            return ActionResult(success=False, action="extract_text", error=f"Element not found: {selector}")
        
        return ActionResult(
            success=True,
            action="extract_text",
            data={
                "text": text,
                "length": len(text),
                "selector": selector
            }
        )
    
    async def _extract_elements(self, req: Dict) -> ActionResult:
        """Extract multiple elements with their attributes"""
        selector = req.get("selector", "*")
        attributes = req.get("attributes", ["href", "src", "value", "placeholder"])
        limit = req.get("limit", 100)
        
        elements_data = await self.page.evaluate(f'''
            (selector, attrs, limit) => {{
                const elements = document.querySelectorAll(selector);
                const results = [];
                for (let i = 0; i < Math.min(elements.length, limit); i++) {{
                    const el = elements[i];
                    const data = {{
                        tag: el.tagName.toLowerCase(),
                        text: el.innerText?.slice(0, 200),
                        attributes: {{}}
                    }};
                    attrs.forEach(attr => {{
                        if (el.hasAttribute(attr)) {{
                            data.attributes[attr] = el.getAttribute(attr);
                        }}
                    }});
                    results.push(data);
                }}
                return results;
            }}
        ''', selector, attributes, limit)
        
        return ActionResult(
            success=True,
            action="extract_elements",
            data={
                "elements": elements_data,
                "count": len(elements_data),
                "selector": selector
            }
        )
    
    async def _get_attribute(self, req: Dict) -> ActionResult:
        """Get attribute value from element"""
        selector = req.get("selector", "")
        attribute = req.get("attribute", "")
        
        if not selector or not attribute:
            return ActionResult(success=False, action="get_attribute", error="selector and attribute required")
        
        element = await self.page.query_selector(selector)
        if element:
            value = await element.get_attribute(attribute)
            return ActionResult(
                success=True,
                action="get_attribute",
                data={"value": value, "selector": selector, "attribute": attribute}
            )
        else:
            return ActionResult(success=False, action="get_attribute", error=f"Element not found: {selector}")
    
    # ========== Advanced Actions ==========
    
    async def _wait_for(self, req: Dict) -> ActionResult:
        """Wait for a condition"""
        selector = req.get("selector")
        state = req.get("state", "visible")  # visible, hidden, attached, detached
        timeout = req.get("timeout", 30000)
        
        if selector:
            await self.page.wait_for_selector(selector, state=state, timeout=timeout)
            return ActionResult(success=True, action="wait_for", data={"selector": selector, "state": state})
        else:
            # Wait for load state
            await self.page.wait_for_load_state(state if state in ['load', 'domcontentloaded', 'networkidle'] else 'networkidle')
            return ActionResult(success=True, action="wait_for", data={"state": state})
    
    async def _evaluate(self, req: Dict) -> ActionResult:
        """Execute JavaScript in the page context"""
        script = req.get("script", "")
        if not script:
            return ActionResult(success=False, action="evaluate", error="Script required")
        
        # Safety check - block dangerous operations
        dangerous_patterns = ['localStorage.clear', 'document.cookie', 'eval(', 'Function(']
        for pattern in dangerous_patterns:
            if pattern in script:
                return ActionResult(success=False, action="evaluate", error=f"Dangerous operation blocked: {pattern}")
        
        result = await self.page.evaluate(script)
        
        return ActionResult(
            success=True,
            action="evaluate",
            data={"result": result}
        )
    
    async def _upload_file(self, req: Dict) -> ActionResult:
        """Upload a file to an input element"""
        selector = req.get("selector", "")
        file_path = req.get("file_path", "")
        
        if not selector or not file_path:
            return ActionResult(success=False, action="upload_file", error="selector and file_path required")
        
        await self.page.set_input_files(selector, file_path)
        
        return ActionResult(
            success=True,
            action="upload_file",
            data={"selector": selector, "file": file_path}
        )
    
    # ========== Facebook-Specific Actions ==========
    
    async def _fb_send_message(self, req: Dict) -> ActionResult:
        """Send a message in Facebook Messenger"""
        message = req.get("message", "")
        if not message:
            return ActionResult(success=False, action="fb_send_message", error="Message required")
        
        # Find the message input
        input_selector = self.fb_selectors["messenger_input"]
        
        try:
            await self.page.wait_for_selector(input_selector, timeout=10000)
            await self.page.click(input_selector)
            await self.page.type(input_selector, message, delay=10)  # 3X FASTER (was 30ms)
            
            # Press Enter to send
            await self.page.keyboard.press("Enter")
            
            return ActionResult(
                success=True,
                action="fb_send_message",
                data={"message_length": len(message), "sent": True}
            )
        except PlaywrightTimeout:
            return ActionResult(
                success=False,
                action="fb_send_message",
                error="Could not find messenger input field"
            )
    
    async def _fb_create_listing(self, req: Dict) -> ActionResult:
        """Create a Facebook Marketplace listing"""
        listing_data = req.get("listing", {})
        
        # Navigate to marketplace create page
        await self.page.goto("https://www.facebook.com/marketplace/create/vehicle")
        await self.page.wait_for_load_state("networkidle")
        
        # This is a template - actual implementation requires dynamic form filling
        return ActionResult(
            success=True,
            action="fb_create_listing",
            data={
                "status": "form_loaded",
                "url": self.page.url,
                "listing_data": listing_data
            }
        )
    
    async def _fb_get_messages(self, req: Dict) -> ActionResult:
        """Get messages from current conversation"""
        limit = req.get("limit", 20)
        
        # Extract messages from the conversation view
        messages = await self.page.evaluate(f'''
            () => {{
                const rows = document.querySelectorAll('div[role="row"]');
                const messages = [];
                rows.forEach(row => {{
                    const text = row.innerText;
                    if (text && text.trim()) {{
                        messages.push({{
                            text: text.slice(0, 500),
                            timestamp: new Date().toISOString()
                        }});
                    }}
                }});
                return messages.slice(-{limit});
            }}
        ''')
        
        return ActionResult(
            success=True,
            action="fb_get_messages",
            data={"messages": messages, "count": len(messages)}
        )
    
    # ========== Helper Methods ==========
    
    async def _human_delay(self):
        """Add human-like random delay between actions"""
        # Enforce minimum delay between actions
        elapsed = (time.time() * 1000) - self.last_action_time
        if elapsed < self.min_action_delay_ms:
            await asyncio.sleep((self.min_action_delay_ms - elapsed) / 1000)
        
        # Add random human-like delay
        delay = random.randint(*self.human_delay_range)
        await asyncio.sleep(delay / 1000)
        
        self.last_action_time = time.time() * 1000
    
    def _record_action(self, request: Dict, result: ActionResult):
        """Record action in history for context"""
        record = {
            "timestamp": datetime.utcnow().isoformat(),
            "action": request.get("action"),
            "success": result.success,
            "url": self.page.url,
            "data": result.data
        }
        
        self.action_history.append(record)
        
        # Trim history
        if len(self.action_history) > self.max_history:
            self.action_history = self.action_history[-self.max_history:]
    
    def get_state(self) -> Dict[str, Any]:
        """Get current browser state for Nova context"""
        return {
            "browser_id": self.browser.browser_id,
            "account_id": self.browser.account_id,
            "current_url": self.current_url,
            "page_title": self.page_title,
            "is_healthy": self.browser.is_healthy,
            "task_count": self.browser.task_count,
            "recent_actions": self.action_history[-10:],
            "has_screenshot": self.last_screenshot is not None
        }
    
    async def save_session(self) -> bool:
        """Save current session state"""
        try:
            storage_state = await self.context.storage_state()
            return await self.session_manager.save_session(
                self.browser.account_id,
                storage_state
            )
        except Exception as e:
            logger.error("Failed to save session", error=str(e))
            return False


# ========== Nova Tooling Registry ==========

NOVA_BROWSER_TOOLS = {
    "name": "browser_control",
    "description": "Control a Chromium browser for Facebook automation",
    "tools": [
        {
            "name": "navigate",
            "description": "Navigate to a URL",
            "parameters": {
                "url": {"type": "string", "required": True, "description": "URL to navigate to"},
                "wait_until": {"type": "string", "default": "networkidle", "description": "When to consider navigation done"}
            }
        },
        {
            "name": "click",
            "description": "Click an element on the page",
            "parameters": {
                "selector": {"type": "string", "required": True, "description": "CSS selector of element to click"}
            }
        },
        {
            "name": "type",
            "description": "Type text into an input field",
            "parameters": {
                "selector": {"type": "string", "required": True, "description": "CSS selector of input field"},
                "value": {"type": "string", "required": True, "description": "Text to type"},
                "clear_first": {"type": "boolean", "default": True, "description": "Clear field before typing"}
            }
        },
        {
            "name": "screenshot",
            "description": "Capture a screenshot of the page for visual analysis",
            "parameters": {
                "full_page": {"type": "boolean", "default": False, "description": "Capture full page or just viewport"},
                "selector": {"type": "string", "description": "Optional: capture specific element"}
            }
        },
        {
            "name": "extract_html",
            "description": "Extract HTML content from the page",
            "parameters": {
                "selector": {"type": "string", "default": "body", "description": "CSS selector to extract from"}
            }
        },
        {
            "name": "extract_text",
            "description": "Extract visible text from an element",
            "parameters": {
                "selector": {"type": "string", "default": "body", "description": "CSS selector to extract from"}
            }
        },
        {
            "name": "scroll",
            "description": "Scroll the page",
            "parameters": {
                "y": {"type": "integer", "default": 300, "description": "Pixels to scroll vertically"},
                "selector": {"type": "string", "description": "Optional: scroll element into view"}
            }
        },
        {
            "name": "wait_for",
            "description": "Wait for an element or page state",
            "parameters": {
                "selector": {"type": "string", "description": "CSS selector to wait for"},
                "state": {"type": "string", "default": "visible", "description": "State: visible, hidden, attached"}
            }
        },
        {
            "name": "fb_send_message",
            "description": "Send a message in Facebook Messenger",
            "parameters": {
                "message": {"type": "string", "required": True, "description": "Message to send"}
            }
        },
        {
            "name": "fb_get_messages",
            "description": "Get messages from current conversation",
            "parameters": {
                "limit": {"type": "integer", "default": 20, "description": "Max messages to retrieve"}
            }
        }
    ]
}
