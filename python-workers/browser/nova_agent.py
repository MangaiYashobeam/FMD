"""
Nova Chromium Agent - The AI Brain Controlling Browsers
=======================================================

This is Nova's core agent loop - the reasoning engine that:
1. Observes the browser state (via screenshots)
2. Thinks about what action to take
3. Executes the action
4. Evaluates the result
5. Repeats until goal is achieved

This implements a ReAct (Reasoning + Acting) agent pattern specifically
designed for Facebook automation.

Key Features:
- Natural language goal understanding
- Visual reasoning via screenshot analysis
- Multi-step task planning
- Error recovery and retry logic
- Human-like behavior patterns
- Session state persistence

Usage:
    agent = NovaAgent(browser_controller)
    
    # Execute a complex goal
    result = await agent.execute_goal(
        "Send a message saying 'Thank you for your interest!' to the current conversation"
    )
    
    # Or use think-act-observe loop directly
    async for step in agent.run_loop("Navigate to Marketplace and create a vehicle listing"):
        print(f"Step: {step.action} -> {step.result}")
"""

import asyncio
import json
import time
from typing import Dict, Any, List, Optional, AsyncGenerator
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum
import structlog

from browser.nova_controller import NovaController, ActionResult
from browser.nova_vision import NovaVisionService, VisionAnalysis, get_vision_service
from core.config import get_settings

logger = structlog.get_logger()


class AgentState(str, Enum):
    """Current state of the agent"""
    IDLE = "idle"
    THINKING = "thinking"
    ACTING = "acting"
    OBSERVING = "observing"
    COMPLETED = "completed"
    FAILED = "failed"
    WAITING = "waiting"


@dataclass
class AgentStep:
    """A single step in the agent's execution"""
    step_number: int
    state: AgentState
    thought: str  # What the agent is thinking
    action: Optional[str] = None
    action_params: Optional[Dict[str, Any]] = None
    result: Optional[Dict[str, Any]] = None
    screenshot: Optional[str] = None
    error: Optional[str] = None
    duration_ms: int = 0
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class AgentExecution:
    """Complete execution record of a goal"""
    goal: str
    success: bool
    steps: List[AgentStep]
    total_duration_ms: int
    final_state: str
    error: Optional[str] = None
    data: Dict[str, Any] = field(default_factory=dict)


class NovaAgent:
    """
    The Nova AI Agent that controls browser automation through reasoning.
    
    This implements a ReAct (Reasoning + Acting) loop:
    1. OBSERVE: Take screenshot, analyze page state
    2. THINK: Decide what action would help achieve the goal
    3. ACT: Execute the chosen action
    4. EVALUATE: Check if goal is achieved or if we need to continue
    
    The agent uses natural language reasoning to handle dynamic situations
    that rule-based automation cannot handle.
    """
    
    def __init__(
        self,
        controller: NovaController,
        vision_service: Optional[NovaVisionService] = None,
        max_steps: int = 50,
        step_timeout: int = 30000
    ):
        self.controller = controller
        self.vision = vision_service or get_vision_service()
        self.settings = get_settings()
        
        # Execution limits
        self.max_steps = max_steps
        self.step_timeout = step_timeout  # ms
        
        # Current state
        self.state = AgentState.IDLE
        self.current_goal: Optional[str] = None
        self.step_history: List[AgentStep] = []
        self.context: Dict[str, Any] = {}
        
        # Knowledge base for Facebook automation
        self.facebook_knowledge = {
            "marketplace_create_url": "https://www.facebook.com/marketplace/create/vehicle",
            "messenger_url": "https://www.facebook.com/messages",
            "login_url": "https://www.facebook.com/login",
            "common_selectors": {
                "messenger_input": 'div[aria-label="Message"]',
                "send_button": 'div[aria-label="Press enter to send"]',
                "marketplace_nav": '[aria-label="Marketplace"]',
                "create_listing": '[aria-label="Create new listing"]',
            }
        }
    
    async def execute_goal(
        self,
        goal: str,
        context: Optional[Dict[str, Any]] = None
    ) -> AgentExecution:
        """
        Execute a high-level goal using the think-act-observe loop.
        
        Args:
            goal: Natural language description of what to accomplish
            context: Additional context (e.g., vehicle data to post)
        
        Returns:
            AgentExecution with complete step history and result
        """
        start_time = time.time()
        self.current_goal = goal
        self.context = context or {}
        self.step_history = []
        self.state = AgentState.THINKING
        
        logger.info("Starting goal execution",
                   goal=goal,
                   browser_id=self.controller.browser.browser_id)
        
        try:
            # Run the agent loop
            async for step in self.run_loop(goal):
                self.step_history.append(step)
                
                # Check for completion or failure
                if step.state == AgentState.COMPLETED:
                    return AgentExecution(
                        goal=goal,
                        success=True,
                        steps=self.step_history,
                        total_duration_ms=int((time.time() - start_time) * 1000),
                        final_state="completed",
                        data=step.result or {}
                    )
                elif step.state == AgentState.FAILED:
                    return AgentExecution(
                        goal=goal,
                        success=False,
                        steps=self.step_history,
                        total_duration_ms=int((time.time() - start_time) * 1000),
                        final_state="failed",
                        error=step.error
                    )
            
            # If we exit the loop without completion
            return AgentExecution(
                goal=goal,
                success=False,
                steps=self.step_history,
                total_duration_ms=int((time.time() - start_time) * 1000),
                final_state="max_steps_reached",
                error=f"Reached maximum steps ({self.max_steps}) without completing goal"
            )
            
        except Exception as e:
            logger.error("Goal execution failed", error=str(e), goal=goal)
            return AgentExecution(
                goal=goal,
                success=False,
                steps=self.step_history,
                total_duration_ms=int((time.time() - start_time) * 1000),
                final_state="error",
                error=str(e)
            )
    
    async def run_loop(self, goal: str) -> AsyncGenerator[AgentStep, None]:
        """
        Run the think-act-observe loop until goal is achieved or max steps reached.
        
        Yields AgentStep for each iteration.
        """
        step_number = 0
        
        while step_number < self.max_steps:
            step_start = time.time()
            step_number += 1
            
            # OBSERVE: Get current state
            self.state = AgentState.OBSERVING
            screenshot_result = await self.controller.execute({"action": "screenshot"})
            screenshot = screenshot_result.screenshot if screenshot_result.success else None
            
            # Analyze what we see
            vision_analysis = None
            if screenshot:
                vision_analysis = await self.vision.analyze(
                    screenshot,
                    goal=goal,
                    context=self._build_context_string()
                )
            
            # THINK: Decide what to do
            self.state = AgentState.THINKING
            thought, action, params, is_complete = await self._think(
                goal, vision_analysis, self.step_history
            )
            
            # Check if goal is complete
            if is_complete:
                yield AgentStep(
                    step_number=step_number,
                    state=AgentState.COMPLETED,
                    thought=thought,
                    action="goal_completed",
                    result={"message": thought},
                    screenshot=screenshot,
                    duration_ms=int((time.time() - step_start) * 1000)
                )
                return
            
            # ACT: Execute the chosen action
            self.state = AgentState.ACTING
            action_result = await self.controller.execute({
                "action": action,
                **params
            })
            
            # Create step record
            step = AgentStep(
                step_number=step_number,
                state=AgentState.ACTING if action_result.success else AgentState.FAILED,
                thought=thought,
                action=action,
                action_params=params,
                result=action_result.data,
                screenshot=screenshot,
                error=action_result.error,
                duration_ms=int((time.time() - step_start) * 1000)
            )
            
            yield step
            
            # Handle failure
            if not action_result.success:
                # Try to recover or fail
                if not await self._can_recover(action_result.error):
                    step.state = AgentState.FAILED
                    return
            
            # Small delay to be human-like
            await asyncio.sleep(0.5)
        
        # Max steps reached
        yield AgentStep(
            step_number=step_number,
            state=AgentState.FAILED,
            thought="Maximum steps reached without completing goal",
            error="max_steps_exceeded",
            duration_ms=0
        )
    
    async def _think(
        self,
        goal: str,
        vision: Optional[VisionAnalysis],
        history: List[AgentStep]
    ) -> tuple[str, str, Dict[str, Any], bool]:
        """
        Think about what action to take next.
        
        This is the reasoning step - analyze the current state and decide
        what action would best progress toward the goal.
        
        Returns:
            (thought, action, params, is_complete)
        """
        # Build reasoning prompt
        prompt = self._build_reasoning_prompt(goal, vision, history)
        
        # For now, use rule-based reasoning
        # TODO: Replace with actual LLM call for complex reasoning
        thought, action, params, is_complete = self._rule_based_reasoning(
            goal, vision, history
        )
        
        logger.debug("Agent thinking",
                    thought=thought,
                    action=action,
                    is_complete=is_complete)
        
        return thought, action, params, is_complete
    
    def _rule_based_reasoning(
        self,
        goal: str,
        vision: Optional[VisionAnalysis],
        history: List[AgentStep]
    ) -> tuple[str, str, Dict[str, Any], bool]:
        """
        Rule-based reasoning for common Facebook automation scenarios.
        
        This serves as a fast path for known patterns and fallback
        when LLM is unavailable.
        """
        goal_lower = goal.lower()
        current_url = self.controller.current_url.lower()
        
        # Detect current page state
        page_state = vision.current_state if vision else "unknown"
        
        # Check for errors
        if vision and vision.error_detected:
            return (
                f"Error detected on page: {vision.error_detected}",
                "screenshot",
                {},
                False
            )
        
        # Goal: Send a message
        if "send" in goal_lower and "message" in goal_lower:
            message = self.context.get("message", "")
            
            if "messenger" not in current_url and page_state != "messenger_conversation":
                return (
                    "Need to navigate to Messenger first",
                    "navigate",
                    {"url": self.facebook_knowledge["messenger_url"]},
                    False
                )
            
            if page_state == "messenger_conversation" and message:
                return (
                    f"In conversation, sending message: {message[:50]}...",
                    "fb_send_message",
                    {"message": message},
                    False
                )
            
            # Check if message was sent (look at history)
            if history and history[-1].action == "fb_send_message":
                if history[-1].result and history[-1].result.get("sent"):
                    return (
                        "Message sent successfully",
                        "goal_completed",
                        {},
                        True
                    )
        
        # Goal: Create a listing
        if "create" in goal_lower and ("listing" in goal_lower or "vehicle" in goal_lower):
            if "marketplace/create" not in current_url:
                return (
                    "Navigating to Marketplace create page",
                    "navigate",
                    {"url": self.facebook_knowledge["marketplace_create_url"]},
                    False
                )
            
            if page_state == "marketplace_create":
                # Start filling the form
                return (
                    "On create listing page, starting to fill form",
                    "fb_create_listing",
                    {"listing": self.context.get("listing_data", {})},
                    False
                )
        
        # Goal: Navigate to a URL
        if "navigate" in goal_lower or "go to" in goal_lower:
            # Extract URL from goal or context
            url = self.context.get("url", "")
            if url:
                if current_url == url.lower():
                    return (
                        f"Already at target URL: {url}",
                        "goal_completed",
                        {},
                        True
                    )
                return (
                    f"Navigating to: {url}",
                    "navigate",
                    {"url": url},
                    False
                )
        
        # Default: Take a screenshot to see what's happening
        if not history or len(history) < 2:
            return (
                "Taking initial screenshot to understand page state",
                "screenshot",
                {},
                False
            )
        
        # If we've taken screenshots but don't know what to do
        if vision and vision.suggested_actions:
            suggestion = vision.suggested_actions[0]
            return (
                f"Following vision suggestion: {suggestion.get('reason', 'next step')}",
                suggestion.get("action", "screenshot"),
                {"selector": suggestion.get("target")} if suggestion.get("target") else {},
                False
            )
        
        # Fallback: We don't know what to do
        return (
            "Unable to determine next action. Please provide more specific instructions.",
            "screenshot",
            {},
            False
        )
    
    def _build_reasoning_prompt(
        self,
        goal: str,
        vision: Optional[VisionAnalysis],
        history: List[AgentStep]
    ) -> str:
        """Build a prompt for LLM-based reasoning"""
        
        prompt = f"""You are Nova, an AI agent controlling a browser for Facebook automation.

## Current Goal
{goal}

## Current Page State
URL: {self.controller.current_url}
Title: {self.controller.page_title}
"""
        
        if vision:
            prompt += f"""
Page Type: {vision.current_state}
Description: {vision.page_description}
Error Visible: {vision.error_detected or 'None'}
"""
            if vision.detected_elements:
                prompt += "\n## Interactive Elements Found\n"
                for el in vision.detected_elements[:10]:
                    prompt += f"- {el.element_type}: {el.description}"
                    if el.suggested_selector:
                        prompt += f" (selector: {el.suggested_selector})"
                    prompt += "\n"
        
        if history:
            prompt += "\n## Recent Actions\n"
            for step in history[-5:]:
                prompt += f"{step.step_number}. {step.action}: {step.thought}\n"
                if step.error:
                    prompt += f"   ERROR: {step.error}\n"
        
        prompt += """
## Available Actions
- navigate(url): Go to a URL
- click(selector): Click an element
- type(selector, value): Type text into an input
- screenshot(): Capture current page
- scroll(y): Scroll the page
- wait_for(selector): Wait for element to appear
- fb_send_message(message): Send a message in Messenger
- fb_create_listing(listing): Create a Marketplace listing

## Your Task
Decide the BEST NEXT ACTION to progress toward the goal.
Return a JSON object with:
{
  "thought": "Your reasoning about the current situation",
  "action": "The action to take",
  "params": {}, // Action parameters
  "is_complete": false // True if goal is achieved
}
"""
        
        return prompt
    
    def _build_context_string(self) -> str:
        """Build context string for vision analysis"""
        parts = [f"Goal: {self.current_goal}"]
        
        if self.context:
            parts.append(f"Context: {json.dumps(self.context)[:500]}")
        
        if self.step_history:
            last_action = self.step_history[-1]
            parts.append(f"Last action: {last_action.action} - {last_action.thought}")
        
        return " | ".join(parts)
    
    async def _can_recover(self, error: Optional[str]) -> bool:
        """
        Check if we can recover from an error.
        
        Some errors are recoverable (element not found -> wait and retry)
        Others are not (page crashed, session invalid)
        """
        if not error:
            return True
        
        error_lower = error.lower()
        
        # Recoverable errors
        recoverable_patterns = [
            "element not found",
            "timeout",
            "not visible",
            "detached"
        ]
        
        for pattern in recoverable_patterns:
            if pattern in error_lower:
                logger.info("Recoverable error, will retry", error=error)
                await asyncio.sleep(1)  # Brief pause before retry
                return True
        
        # Non-recoverable errors
        fatal_patterns = [
            "session",
            "login required",
            "blocked",
            "banned"
        ]
        
        for pattern in fatal_patterns:
            if pattern in error_lower:
                logger.error("Fatal error, cannot recover", error=error)
                return False
        
        # Default: try to recover once
        return True
    
    def get_execution_summary(self) -> Dict[str, Any]:
        """Get a summary of the current execution state"""
        return {
            "goal": self.current_goal,
            "state": self.state.value,
            "steps_taken": len(self.step_history),
            "max_steps": self.max_steps,
            "current_url": self.controller.current_url,
            "last_action": self.step_history[-1].action if self.step_history else None,
            "last_thought": self.step_history[-1].thought if self.step_history else None
        }


# ========== High-Level Task Functions ==========

async def send_facebook_message(
    controller: NovaController,
    conversation_url: str,
    message: str
) -> AgentExecution:
    """
    High-level function to send a Facebook message.
    
    Args:
        controller: Browser controller
        conversation_url: URL of the conversation
        message: Message to send
    
    Returns:
        AgentExecution with result
    """
    agent = NovaAgent(controller)
    
    return await agent.execute_goal(
        goal=f"Navigate to the conversation and send this message: {message}",
        context={
            "url": conversation_url,
            "message": message
        }
    )


async def create_marketplace_listing(
    controller: NovaController,
    listing_data: Dict[str, Any]
) -> AgentExecution:
    """
    High-level function to create a Facebook Marketplace listing.
    
    Args:
        controller: Browser controller
        listing_data: Vehicle/item data for the listing
    
    Returns:
        AgentExecution with result
    """
    agent = NovaAgent(controller)
    
    return await agent.execute_goal(
        goal="Create a new vehicle listing on Facebook Marketplace with the provided data",
        context={
            "listing_data": listing_data
        }
    )


async def respond_to_inquiry(
    controller: NovaController,
    conversation_url: str,
    customer_message: str,
    response_template: str
) -> AgentExecution:
    """
    High-level function to respond to a customer inquiry.
    
    Args:
        controller: Browser controller
        conversation_url: URL of the conversation
        customer_message: What the customer asked
        response_template: Template for the response
    
    Returns:
        AgentExecution with result
    """
    agent = NovaAgent(controller)
    
    # The agent could use an LLM to customize the response
    return await agent.execute_goal(
        goal=f"Open the conversation and send a response to the customer's inquiry about: {customer_message[:100]}",
        context={
            "url": conversation_url,
            "customer_inquiry": customer_message,
            "message": response_template
        }
    )
