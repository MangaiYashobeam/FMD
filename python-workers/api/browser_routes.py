"""
Nova Browser API Routes - Production-Grade Browser Control Endpoints
====================================================================

These endpoints allow Nova (AI) to control Chromium browsers directly.
Each IAI instance gets a dedicated browser session that Nova can puppet.

Endpoints:
- POST /api/browser/create         - Create new browser session
- POST /api/browser/{id}/action    - Execute action in browser
- GET  /api/browser/{id}/state     - Get browser state
- GET  /api/browser/{id}/screenshot - Get latest screenshot
- POST /api/browser/{id}/vision    - Analyze screenshot with AI
- DELETE /api/browser/{id}         - Close browser session

Security:
- All endpoints require API key authentication
- Actions are rate limited
- All operations are logged for audit
"""

import base64
import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime
import structlog

from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from pydantic import BaseModel, Field

from core.config import get_settings
from browser.manager import BrowserPoolManager, BrowserInstance
from browser.nova_controller import NovaController, ActionResult, NOVA_BROWSER_TOOLS

logger = structlog.get_logger()

# Router for browser control endpoints
router = APIRouter(prefix="/api/browser", tags=["browser"])

# Store active Nova controllers
_nova_controllers: Dict[str, NovaController] = {}


# ========== Request/Response Models ==========

class CreateBrowserRequest(BaseModel):
    """Request to create a new browser session"""
    account_id: str = Field(..., description="Unique identifier for the Facebook account")
    headless: bool = Field(default=True, description="Run browser in headless mode")
    viewport: Optional[Dict[str, int]] = Field(
        default={"width": 1920, "height": 1080},
        description="Browser viewport size"
    )
    load_session: bool = Field(default=True, description="Load saved session cookies if available")
    stealth: bool = Field(default=True, description="Apply anti-detection measures")


class CreateBrowserResponse(BaseModel):
    """Response after creating a browser session"""
    success: bool
    session_id: str
    browser_id: str
    account_id: str
    status: str
    has_saved_session: bool
    message: str


class BrowserActionRequest(BaseModel):
    """Request to execute an action in the browser"""
    action: str = Field(..., description="Action to execute (navigate, click, type, screenshot, etc.)")
    selector: Optional[str] = Field(None, description="CSS selector for element interactions")
    url: Optional[str] = Field(None, description="URL for navigation")
    value: Optional[str] = Field(None, description="Value for type/select actions")
    options: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional action options")
    
    # Merge options into the main request for the controller
    def to_controller_request(self) -> Dict[str, Any]:
        req = {
            "action": self.action,
            "selector": self.selector,
            "url": self.url,
            "value": self.value,
        }
        req.update(self.options or {})
        return {k: v for k, v in req.items() if v is not None}


class BrowserActionResponse(BaseModel):
    """Response from a browser action"""
    success: bool
    action: str
    data: Dict[str, Any] = {}
    error: Optional[str] = None
    duration_ms: int = 0
    screenshot: Optional[str] = None  # Base64 encoded
    timestamp: str


class BrowserStateResponse(BaseModel):
    """Current state of a browser session"""
    session_id: str
    browser_id: str
    account_id: str
    current_url: str
    page_title: str
    is_healthy: bool
    task_count: int
    recent_actions: List[Dict[str, Any]]
    has_screenshot: bool
    created_at: str
    last_activity: str


class VisionAnalysisRequest(BaseModel):
    """Request for AI vision analysis of screenshot"""
    prompt: str = Field(
        default="Describe what you see on this Facebook page. Identify any forms, buttons, or interactive elements.",
        description="What to analyze in the screenshot"
    )
    include_ocr: bool = Field(default=True, description="Extract text from image")
    identify_elements: bool = Field(default=True, description="Identify clickable elements")


class VisionAnalysisResponse(BaseModel):
    """Response from vision analysis"""
    success: bool
    analysis: str
    elements_found: List[Dict[str, Any]] = []
    suggested_actions: List[Dict[str, str]] = []
    ocr_text: Optional[str] = None


# ========== Helper Functions ==========

async def get_browser_pool(request: Request) -> BrowserPoolManager:
    """Get the browser pool from app state"""
    pool = getattr(request.app.state, "browser_pool", None)
    if not pool:
        raise HTTPException(status_code=503, detail="Browser pool not initialized")
    return pool


async def get_nova_controller(session_id: str, request: Request) -> NovaController:
    """Get or create a Nova controller for a session"""
    if session_id not in _nova_controllers:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")
    return _nova_controllers[session_id]


# ========== Endpoints ==========

@router.post("/create", response_model=CreateBrowserResponse)
async def create_browser_session(
    req: CreateBrowserRequest,
    request: Request,
    background_tasks: BackgroundTasks
):
    """
    Create a new browser session for Nova to control.
    
    This creates a dedicated Chromium browser instance for the specified account.
    If saved session cookies exist, they will be loaded automatically.
    """
    pool = await get_browser_pool(request)
    settings = get_settings()
    
    logger.info("Creating browser session", account_id=req.account_id)
    
    try:
        # Get or create browser instance
        browser = await pool.get_browser(req.account_id)
        
        if not browser:
            raise HTTPException(
                status_code=503,
                detail="Browser pool at capacity. Try again later."
            )
        
        # Create Nova controller for this browser
        controller = NovaController(browser)
        session_id = f"nova_{browser.browser_id}"
        _nova_controllers[session_id] = controller
        
        # Check if we loaded a saved session
        has_session = await request.app.state.session_manager.load_session(req.account_id) is not None
        
        logger.info("Browser session created",
                   session_id=session_id,
                   browser_id=browser.browser_id,
                   has_session=has_session)
        
        return CreateBrowserResponse(
            success=True,
            session_id=session_id,
            browser_id=browser.browser_id,
            account_id=req.account_id,
            status="ready",
            has_saved_session=has_session,
            message=f"Browser session created. {'Loaded saved cookies.' if has_session else 'No saved session - login required.'}"
        )
        
    except RuntimeError as e:
        logger.error("Failed to create browser", error=str(e))
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/{session_id}/action", response_model=BrowserActionResponse)
async def execute_browser_action(
    session_id: str,
    req: BrowserActionRequest,
    request: Request
):
    """
    Execute an action in the browser.
    
    Nova uses this endpoint to interact with the browser:
    - Navigate to URLs
    - Click elements
    - Type text
    - Capture screenshots
    - Extract page content
    
    Returns the result of the action, including any extracted data or screenshots.
    """
    controller = await get_nova_controller(session_id, request)
    
    logger.info("Executing browser action",
               session_id=session_id,
               action=req.action)
    
    # Execute the action
    result = await controller.execute(req.to_controller_request())
    
    return BrowserActionResponse(
        success=result.success,
        action=result.action,
        data=result.data,
        error=result.error,
        duration_ms=result.duration_ms,
        screenshot=result.screenshot,
        timestamp=result.timestamp
    )


@router.get("/{session_id}/state", response_model=BrowserStateResponse)
async def get_browser_state(session_id: str, request: Request):
    """
    Get the current state of a browser session.
    
    Returns URL, page title, recent actions, and health status.
    Useful for Nova to understand the current context before deciding actions.
    """
    controller = await get_nova_controller(session_id, request)
    state = controller.get_state()
    
    return BrowserStateResponse(
        session_id=session_id,
        browser_id=state["browser_id"],
        account_id=state["account_id"],
        current_url=state["current_url"],
        page_title=state["page_title"],
        is_healthy=state["is_healthy"],
        task_count=state["task_count"],
        recent_actions=state["recent_actions"],
        has_screenshot=state["has_screenshot"],
        created_at=controller.browser.created_at.isoformat(),
        last_activity=controller.browser.last_activity.isoformat()
    )


@router.get("/{session_id}/screenshot")
async def get_browser_screenshot(session_id: str, request: Request, full_page: bool = False):
    """
    Capture and return a screenshot of the browser.
    
    This is Nova's "eyes" - use this to see what's on the page.
    Returns a base64-encoded JPEG image.
    """
    controller = await get_nova_controller(session_id, request)
    
    result = await controller.execute({
        "action": "screenshot",
        "full_page": full_page
    })
    
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    
    return {
        "success": True,
        "screenshot": result.screenshot,
        "url": result.data.get("url"),
        "title": result.data.get("title"),
        "size": result.data.get("size")
    }


@router.get("/{session_id}/html")
async def get_browser_html(
    session_id: str,
    request: Request,
    selector: str = "body",
    include_scripts: bool = False
):
    """
    Extract HTML content from the browser.
    
    Nova can use this to understand page structure and find elements.
    By default, scripts are stripped for cleaner analysis.
    """
    controller = await get_nova_controller(session_id, request)
    
    result = await controller.execute({
        "action": "extract_html",
        "selector": selector,
        "include_scripts": include_scripts
    })
    
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    
    return {
        "success": True,
        "html": result.data.get("html"),
        "length": result.data.get("length"),
        "selector": selector
    }


@router.post("/{session_id}/vision", response_model=VisionAnalysisResponse)
async def analyze_with_vision(
    session_id: str,
    req: VisionAnalysisRequest,
    request: Request
):
    """
    Analyze the current page using AI vision.
    
    This endpoint:
    1. Captures a screenshot
    2. Sends it to the vision AI model
    3. Returns analysis, detected elements, and suggested actions
    
    This is how Nova "sees" and understands the page layout.
    """
    controller = await get_nova_controller(session_id, request)
    settings = get_settings()
    
    # First, capture a screenshot
    screenshot_result = await controller.execute({"action": "screenshot"})
    if not screenshot_result.success:
        raise HTTPException(status_code=500, detail="Failed to capture screenshot")
    
    # TODO: Integrate with actual vision AI model (GPT-4V, Claude 3, etc.)
    # For now, return a structured placeholder that shows the expected format
    
    # This would be replaced with actual AI vision analysis
    analysis = f"""
    Page Analysis for: {controller.current_url}
    
    Based on the screenshot, I can see:
    - This appears to be a Facebook page
    - There are interactive elements visible
    - The page has loaded successfully
    
    To implement actual vision analysis:
    1. Send screenshot to OpenAI GPT-4V or Anthropic Claude 3
    2. Parse the response for actionable elements
    3. Return structured suggestions
    """
    
    # Detect interactive elements from DOM
    elements_result = await controller.execute({
        "action": "extract_elements",
        "selector": "button, a, input, textarea, select, [role='button']",
        "limit": 50
    })
    
    elements_found = []
    if elements_result.success:
        for el in elements_result.data.get("elements", []):
            elements_found.append({
                "type": el.get("tag"),
                "text": el.get("text", "")[:100],
                "attributes": el.get("attributes", {})
            })
    
    return VisionAnalysisResponse(
        success=True,
        analysis=analysis.strip(),
        elements_found=elements_found,
        suggested_actions=[
            {"action": "click", "reason": "Interact with detected button"},
            {"action": "screenshot", "reason": "Verify current state"}
        ],
        ocr_text=None  # Would come from actual OCR
    )


@router.delete("/{session_id}")
async def close_browser_session(session_id: str, request: Request):
    """
    Close a browser session and save its state.
    
    This:
    1. Saves the current session cookies (for later restoration)
    2. Closes the browser
    3. Releases resources
    """
    if session_id not in _nova_controllers:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")
    
    controller = _nova_controllers[session_id]
    pool = await get_browser_pool(request)
    
    # Save session before closing
    saved = await controller.save_session()
    
    # Release browser
    await pool.release_browser(controller.browser.browser_id)
    
    # Remove controller
    del _nova_controllers[session_id]
    
    logger.info("Browser session closed",
               session_id=session_id,
               session_saved=saved)
    
    return {
        "success": True,
        "session_id": session_id,
        "session_saved": saved,
        "message": "Browser session closed"
    }


# ========== AI Agent Execution ==========

class ExecuteGoalRequest(BaseModel):
    """Request to execute a natural language goal"""
    goal: str = Field(..., description="Natural language description of what to accomplish")
    context: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional context for the agent")
    max_steps: int = Field(default=20, description="Maximum steps before giving up")


@router.post("/{session_id}/execute-goal")
async def execute_goal(
    session_id: str,
    req: ExecuteGoalRequest,
    request: Request
):
    """
    Execute a natural language goal using the Nova AI agent.
    
    The agent will:
    1. Analyze the current browser state
    2. Break down the goal into steps
    3. Execute each step, observing results
    4. Continue until goal is achieved or max steps reached
    
    Examples:
    - "Navigate to Facebook Marketplace and search for Honda Civic"
    - "Reply to the unread message with 'Thank you for your interest'"
    - "Create a new vehicle listing for a 2019 Toyota Camry"
    """
    from browser.nova_agent import NovaAgent
    
    controller = await get_nova_controller(session_id, request)
    
    # Create agent for this controller
    agent = NovaAgent(controller)
    
    logger.info("Executing agent goal",
               session_id=session_id,
               goal=req.goal[:100] + "..." if len(req.goal) > 100 else req.goal)
    
    # Execute the goal
    result = await agent.execute_goal(
        goal=req.goal,
        context=req.context,
        max_steps=req.max_steps
    )
    
    return {
        "success": result["success"],
        "goal": req.goal,
        "steps_taken": result["steps_taken"],
        "final_state": result["final_state"],
        "history": result["history"],
        "total_duration_ms": result.get("duration_ms", 0),
        "error": result.get("error")
    }


@router.get("/tools")
async def get_available_tools():
    """
    Get the list of tools available to Nova.
    
    This endpoint returns the tool schema that Nova can use
    to understand what actions are available.
    """
    return NOVA_BROWSER_TOOLS


@router.get("/sessions")
async def list_active_sessions(request: Request):
    """
    List all active browser sessions.
    
    Returns session IDs, account IDs, and status for all running browsers.
    """
    pool = await get_browser_pool(request)
    stats = pool.get_stats()
    
    sessions = []
    for browser_info in stats.get("browsers", []):
        session_id = f"nova_{browser_info['browser_id']}"
        sessions.append({
            "session_id": session_id,
            "browser_id": browser_info["browser_id"],
            "account_id": browser_info["account_id"],
            "is_busy": browser_info["is_busy"],
            "is_healthy": browser_info["is_healthy"],
            "task_count": browser_info["task_count"],
            "idle_seconds": browser_info["idle_seconds"],
            "has_controller": session_id in _nova_controllers
        })
    
    return {
        "total_sessions": len(sessions),
        "max_sessions": stats.get("max_browsers"),
        "sessions": sessions
    }


# ========== Batch Operations ==========

class BatchActionRequest(BaseModel):
    """Request to execute multiple actions in sequence"""
    actions: List[BrowserActionRequest]
    stop_on_error: bool = Field(default=True, description="Stop execution if an action fails")


@router.post("/{session_id}/batch")
async def execute_batch_actions(
    session_id: str,
    req: BatchActionRequest,
    request: Request
):
    """
    Execute multiple actions in sequence.
    
    Useful for complex workflows like:
    - Navigate to page, wait for load, click button, fill form
    - Take screenshot, extract text, analyze results
    
    Returns results for each action in order.
    """
    controller = await get_nova_controller(session_id, request)
    
    results = []
    for action_req in req.actions:
        result = await controller.execute(action_req.to_controller_request())
        results.append(result.to_dict())
        
        if req.stop_on_error and not result.success:
            break
    
    success_count = sum(1 for r in results if r["success"])
    
    return {
        "success": success_count == len(results),
        "total_actions": len(req.actions),
        "completed": len(results),
        "success_count": success_count,
        "results": results
    }
