"""
Nova Vision Service - AI-Powered Screenshot Analysis
====================================================

This service provides Nova with "eyes" - the ability to see and understand
what's displayed in the browser through vision AI analysis.

Features:
- Screenshot to AI vision model pipeline
- Element detection and labeling
- Natural language description of page state
- OCR text extraction
- Suggested next actions based on visual analysis

Supported Models:
- OpenAI GPT-4 Vision
- Anthropic Claude 3 Vision
- Google Gemini Pro Vision (future)

Architecture:
    Browser Screenshot → Base64 Image → Vision AI → Structured Analysis
"""

import base64
import json
import httpx
import structlog
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from dataclasses import dataclass
from enum import Enum

from core.config import get_settings

logger = structlog.get_logger()


class VisionModel(str, Enum):
    """Supported vision AI models"""
    GPT4_VISION = "gpt-4-vision-preview"
    GPT4O = "gpt-4o"
    CLAUDE_3_OPUS = "claude-3-opus-20240229"
    CLAUDE_3_SONNET = "claude-3-sonnet-20240229"
    CLAUDE_3_HAIKU = "claude-3-haiku-20240307"


@dataclass
class DetectedElement:
    """An element detected in the screenshot"""
    element_type: str  # button, input, link, text, image, form
    description: str
    suggested_selector: Optional[str]
    bounding_box: Optional[Dict[str, int]]  # x, y, width, height
    actionable: bool
    priority: int  # 1-10, how important for current goal


@dataclass
class VisionAnalysis:
    """Complete analysis of a screenshot"""
    success: bool
    page_description: str
    detected_elements: List[DetectedElement]
    suggested_actions: List[Dict[str, str]]
    current_state: str  # login_page, marketplace, messenger, etc.
    error_detected: Optional[str]  # Any error messages visible
    ocr_text: Optional[str]
    confidence: float
    model_used: str
    analysis_time_ms: int


class NovaVisionService:
    """
    AI Vision service for analyzing browser screenshots.
    
    Nova uses this to:
    1. Understand what's on the screen
    2. Identify interactive elements
    3. Decide what action to take next
    
    Usage:
        vision = NovaVisionService()
        
        # Analyze a screenshot
        analysis = await vision.analyze(
            screenshot_b64="...",
            goal="Find the 'Post Listing' button and describe how to reach it"
        )
        
        print(analysis.suggested_actions)
    """
    
    def __init__(self, model: VisionModel = VisionModel.GPT4O):
        self.settings = get_settings()
        self.model = model
        self.http_client: Optional[httpx.AsyncClient] = None
        
        # Model-specific configurations
        self.model_configs = {
            VisionModel.GPT4O: {
                "api_url": "https://api.openai.com/v1/chat/completions",
                "api_key_env": "OPENAI_API_KEY",
                "max_tokens": 4096,
            },
            VisionModel.GPT4_VISION: {
                "api_url": "https://api.openai.com/v1/chat/completions",
                "api_key_env": "OPENAI_API_KEY",
                "max_tokens": 4096,
            },
            VisionModel.CLAUDE_3_SONNET: {
                "api_url": "https://api.anthropic.com/v1/messages",
                "api_key_env": "ANTHROPIC_API_KEY",
                "max_tokens": 4096,
            },
            VisionModel.CLAUDE_3_HAIKU: {
                "api_url": "https://api.anthropic.com/v1/messages",
                "api_key_env": "ANTHROPIC_API_KEY",
                "max_tokens": 4096,
            },
        }
        
        # Facebook-specific prompts
        self.fb_context = """
        You are analyzing a Facebook page screenshot for an automated car dealer system.
        
        Common Facebook elements to identify:
        - Messenger chat windows and message inputs
        - Marketplace listing creation forms
        - Navigation elements (Home, Marketplace, Messenger icons)
        - Login forms and authentication prompts
        - CAPTCHAs or security challenges
        - Error messages or warnings
        - Post/listing cards with vehicle information
        
        When analyzing:
        1. Describe what page/state is currently showing
        2. Identify all interactive elements (buttons, inputs, links)
        3. Note any error messages or warnings
        4. Suggest CSS selectors for key elements when possible
        5. Recommend the next best action to achieve the goal
        """
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client"""
        if not self.http_client:
            self.http_client = httpx.AsyncClient(timeout=60.0)
        return self.http_client
    
    async def analyze(
        self,
        screenshot_b64: str,
        goal: str = "Describe what you see on this page and identify interactive elements",
        context: Optional[str] = None,
        detect_elements: bool = True,
        extract_text: bool = True
    ) -> VisionAnalysis:
        """
        Analyze a screenshot using vision AI.
        
        Args:
            screenshot_b64: Base64 encoded screenshot (JPEG or PNG)
            goal: What Nova is trying to accomplish
            context: Additional context about the current task
            detect_elements: Whether to identify interactive elements
            extract_text: Whether to extract visible text via OCR
        
        Returns:
            VisionAnalysis with detected elements and suggested actions
        """
        import time
        start_time = time.time()
        
        try:
            # Build the analysis prompt
            prompt = self._build_analysis_prompt(goal, context, detect_elements, extract_text)
            
            # Call the vision model
            if self.model in [VisionModel.GPT4O, VisionModel.GPT4_VISION]:
                response = await self._call_openai_vision(screenshot_b64, prompt)
            else:
                response = await self._call_anthropic_vision(screenshot_b64, prompt)
            
            # Parse the response
            analysis = self._parse_vision_response(response)
            analysis.model_used = self.model.value
            analysis.analysis_time_ms = int((time.time() - start_time) * 1000)
            
            logger.info("Vision analysis complete",
                       model=self.model.value,
                       elements_found=len(analysis.detected_elements),
                       time_ms=analysis.analysis_time_ms)
            
            return analysis
            
        except Exception as e:
            logger.error("Vision analysis failed", error=str(e))
            return VisionAnalysis(
                success=False,
                page_description=f"Analysis failed: {str(e)}",
                detected_elements=[],
                suggested_actions=[],
                current_state="unknown",
                error_detected=str(e),
                ocr_text=None,
                confidence=0.0,
                model_used=self.model.value,
                analysis_time_ms=int((time.time() - start_time) * 1000)
            )
    
    def _build_analysis_prompt(
        self,
        goal: str,
        context: Optional[str],
        detect_elements: bool,
        extract_text: bool
    ) -> str:
        """Build the prompt for vision analysis"""
        
        prompt_parts = [
            self.fb_context,
            f"\n## Current Goal\n{goal}",
        ]
        
        if context:
            prompt_parts.append(f"\n## Additional Context\n{context}")
        
        prompt_parts.append("""
## Required Output (JSON format)

Please analyze the screenshot and respond with a JSON object containing:

```json
{
  "page_description": "Brief description of what page/state is showing",
  "current_state": "One of: login_page, home_feed, marketplace, marketplace_create, messenger, messenger_conversation, profile, settings, error_page, captcha, unknown",
  "error_detected": "Any error message visible, or null if none",
  "confidence": 0.0-1.0,
""")
        
        if detect_elements:
            prompt_parts.append("""
  "detected_elements": [
    {
      "element_type": "button|input|link|text|image|form|dropdown",
      "description": "What this element is for",
      "suggested_selector": "CSS selector if identifiable",
      "actionable": true/false,
      "priority": 1-10
    }
  ],
""")
        
        prompt_parts.append("""
  "suggested_actions": [
    {
      "action": "click|type|navigate|scroll|wait",
      "target": "selector or description",
      "reason": "Why this action helps achieve the goal"
    }
  ],
""")
        
        if extract_text:
            prompt_parts.append("""
  "ocr_text": "Key text visible on the page (especially error messages, form labels, button text)"
""")
        
        prompt_parts.append("}\n```")
        
        return "\n".join(prompt_parts)
    
    async def _call_openai_vision(self, screenshot_b64: str, prompt: str) -> Dict[str, Any]:
        """Call OpenAI GPT-4 Vision API"""
        import os
        
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not configured")
        
        client = await self._get_client()
        
        # Ensure proper base64 format
        if not screenshot_b64.startswith("data:image"):
            screenshot_b64 = f"data:image/jpeg;base64,{screenshot_b64}"
        
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": self.model.value,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": screenshot_b64,
                                    "detail": "high"
                                }
                            }
                        ]
                    }
                ],
                "max_tokens": 4096
            }
        )
        
        response.raise_for_status()
        data = response.json()
        
        return {
            "content": data["choices"][0]["message"]["content"],
            "usage": data.get("usage", {})
        }
    
    async def _call_anthropic_vision(self, screenshot_b64: str, prompt: str) -> Dict[str, Any]:
        """Call Anthropic Claude Vision API"""
        import os
        
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not configured")
        
        client = await self._get_client()
        
        # Claude expects raw base64 without data URL prefix
        if screenshot_b64.startswith("data:image"):
            screenshot_b64 = screenshot_b64.split(",")[1]
        
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "Content-Type": "application/json",
                "anthropic-version": "2023-06-01"
            },
            json={
                "model": self.model.value,
                "max_tokens": 4096,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/jpeg",
                                    "data": screenshot_b64
                                }
                            },
                            {
                                "type": "text",
                                "text": prompt
                            }
                        ]
                    }
                ]
            }
        )
        
        response.raise_for_status()
        data = response.json()
        
        return {
            "content": data["content"][0]["text"],
            "usage": data.get("usage", {})
        }
    
    def _parse_vision_response(self, response: Dict[str, Any]) -> VisionAnalysis:
        """Parse the vision model response into structured analysis"""
        content = response.get("content", "")
        
        # Try to extract JSON from the response
        try:
            # Find JSON block in response
            json_start = content.find("{")
            json_end = content.rfind("}") + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = content[json_start:json_end]
                data = json.loads(json_str)
            else:
                # No JSON found, create from text
                data = {
                    "page_description": content,
                    "current_state": "unknown",
                    "confidence": 0.5
                }
        except json.JSONDecodeError:
            data = {
                "page_description": content,
                "current_state": "unknown",
                "confidence": 0.5
            }
        
        # Parse detected elements
        detected_elements = []
        for el in data.get("detected_elements", []):
            detected_elements.append(DetectedElement(
                element_type=el.get("element_type", "unknown"),
                description=el.get("description", ""),
                suggested_selector=el.get("suggested_selector"),
                bounding_box=el.get("bounding_box"),
                actionable=el.get("actionable", False),
                priority=el.get("priority", 5)
            ))
        
        return VisionAnalysis(
            success=True,
            page_description=data.get("page_description", ""),
            detected_elements=detected_elements,
            suggested_actions=data.get("suggested_actions", []),
            current_state=data.get("current_state", "unknown"),
            error_detected=data.get("error_detected"),
            ocr_text=data.get("ocr_text"),
            confidence=float(data.get("confidence", 0.5)),
            model_used="",  # Set by caller
            analysis_time_ms=0  # Set by caller
        )
    
    async def quick_check(self, screenshot_b64: str) -> Tuple[str, bool]:
        """
        Quick check to determine page state without full analysis.
        
        Returns:
            (state, has_error): Current state and whether an error is visible
        """
        analysis = await self.analyze(
            screenshot_b64,
            goal="Quickly identify the current page state and check for errors",
            detect_elements=False,
            extract_text=False
        )
        
        return analysis.current_state, analysis.error_detected is not None
    
    async def find_element(
        self,
        screenshot_b64: str,
        element_description: str
    ) -> Optional[DetectedElement]:
        """
        Find a specific element in the screenshot.
        
        Args:
            screenshot_b64: Screenshot to analyze
            element_description: Natural language description of the element
        
        Returns:
            DetectedElement if found, None otherwise
        """
        analysis = await self.analyze(
            screenshot_b64,
            goal=f"Find this element: {element_description}. Return its selector if possible.",
            detect_elements=True,
            extract_text=False
        )
        
        if analysis.detected_elements:
            # Return the highest priority match
            return max(analysis.detected_elements, key=lambda e: e.priority)
        
        return None
    
    async def close(self):
        """Close HTTP client"""
        if self.http_client:
            await self.http_client.aclose()
            self.http_client = None


# Global vision service instance
_vision_service: Optional[NovaVisionService] = None


def get_vision_service() -> NovaVisionService:
    """Get or create the global vision service"""
    global _vision_service
    if _vision_service is None:
        _vision_service = NovaVisionService()
    return _vision_service
