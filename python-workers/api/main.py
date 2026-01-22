"""
FastAPI Application - Worker Management API
Provides endpoints for managing headless browser workers

Security Features:
- Rate limiting per IP
- HMAC request signature verification
- Strict input validation
- CORS restrictions
- Security event logging
"""
import asyncio
from contextlib import asynccontextmanager
from typing import Optional, Annotated
from datetime import datetime
import uuid
import time
import structlog

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Header, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel, Field, field_validator

from core.config import get_settings
from core.redis_client import get_redis_queue
from core.security import (
    get_security_config,
    get_rate_limiter,
    get_security_monitor,
    get_input_validator,
    NetworkSecurity,
    AuthenticationManager,
    SecurityEventType,
    RateLimitExceeded,
    InvalidInputError,
)
from browser.session import SessionManager

logger = structlog.get_logger()

# Global worker reference (for single-worker mode)
_posting_worker = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    settings = get_settings()
    security_config = get_security_config()
    
    logger.info("Starting Worker API",
               worker_id=settings.worker_id,
               security_level=security_config.security_level.value,
               api_port=8000)
    
    # Initialize Redis
    redis = await get_redis_queue()
    app.state.redis = redis
    app.state.session_manager = SessionManager()
    app.state.rate_limiter = get_rate_limiter()
    app.state.security_monitor = get_security_monitor()
    app.state.input_validator = get_input_validator()
    
    # Initialize auth manager if secret is configured
    if settings.worker_secret:
        app.state.auth_manager = AuthenticationManager(settings.worker_secret)
    else:
        app.state.auth_manager = None
        logger.warning("WORKER_SECRET not configured - signature verification disabled")
    
    yield
    
    # Cleanup
    logger.info("Shutting down Worker API")


# =============================================================================
# Security Middleware
# =============================================================================

class SecurityMiddleware(BaseHTTPMiddleware):
    """
    Defense-in-depth security middleware
    
    Performs:
    - IP validation
    - Rate limiting
    - Request logging
    - Security header injection
    """
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        settings = get_settings()
        security_config = get_security_config()
        
        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        
        # IP validation (skip for health checks)
        if request.url.path != "/health":
            network_security = NetworkSecurity(security_config)
            if not network_security.is_ip_allowed(client_ip):
                monitor = get_security_monitor()
                await monitor.log_event(
                    SecurityEventType.AUTH_FAILURE,
                    source_ip=client_ip,
                    details={"reason": "IP not allowed", "path": request.url.path},
                    severity="medium"
                )
                return Response(
                    content='{"detail": "Access denied"}',
                    status_code=403,
                    media_type="application/json"
                )
        
        # Rate limiting (skip for health checks)
        if request.url.path != "/health":
            rate_limiter = get_rate_limiter()
            if not await rate_limiter.is_allowed(client_ip):
                monitor = get_security_monitor()
                await monitor.log_event(
                    SecurityEventType.RATE_LIMIT_EXCEEDED,
                    source_ip=client_ip,
                    details={"path": request.url.path},
                    severity="medium"
                )
                return Response(
                    content='{"detail": "Rate limit exceeded"}',
                    status_code=429,
                    media_type="application/json"
                )
        
        # Process request
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Cache-Control"] = "no-store"
        
        # Add rate limit headers (only for non-health endpoints)
        if request.url.path != "/health":
            rate_limiter = get_rate_limiter()
            remaining = await rate_limiter.get_remaining(client_ip)
            response.headers["X-RateLimit-Remaining"] = str(remaining)
            response.headers["X-RateLimit-Limit"] = str(security_config.rate_limit_requests)
        
        # Log request (audit)
        duration_ms = (time.time() - start_time) * 1000
        if security_config.audit_all_requests:
            logger.info("API request",
                       method=request.method,
                       path=request.url.path,
                       client_ip=client_ip,
                       status=response.status_code,
                       duration_ms=round(duration_ms, 2))
        
        return response


def create_app() -> FastAPI:
    """Create FastAPI application with security middleware"""
    settings = get_settings()
    
    app = FastAPI(
        title="FaceMyDealer Worker API",
        description="API for managing headless browser automation workers",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if not settings.is_production() else None,  # Disable in production
        redoc_url="/redoc" if not settings.is_production() else None,
    )
    
    # Add security middleware FIRST
    app.add_middleware(SecurityMiddleware)
    
    # CORS - restricted to configured origins
    cors_origins = settings.get_cors_origins()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Content-Type", "X-API-Key", "X-Timestamp", "X-Nonce", "X-Signature"],
        expose_headers=["X-RateLimit-Remaining", "X-RateLimit-Limit"],
    )
    
    logger.info("CORS configured", origins=cors_origins)
    
    return app


app = create_app()


# ========== Pydantic Models ==========

class TaskCreate(BaseModel):
    """Model for creating a new task"""
    type: str = Field(..., description="Task type: post_vehicle, post_item, validate_session")
    account_id: str = Field(..., description="Facebook account ID")
    data: dict = Field(default_factory=dict, description="Task-specific payload")
    priority: str = Field(default="normal", description="Priority: high, normal, low")
    
    @field_validator("type")
    @classmethod
    def validate_type(cls, v):
        valid_types = {"post_vehicle", "post_item", "validate_session", "setup_session"}
        if v not in valid_types:
            raise ValueError(f"Invalid task type. Must be one of: {valid_types}")
        return v
    
    @field_validator("account_id")
    @classmethod
    def validate_account_id(cls, v):
        validator = get_input_validator()
        if not validator.validate_account_id(v):
            raise ValueError("Invalid account_id format")
        return v
    
    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v):
        if v not in {"high", "normal", "low"}:
            raise ValueError("Priority must be high, normal, or low")
        return v


class TaskResponse(BaseModel):
    """Task creation response"""
    task_id: str
    status: str
    queued_at: str


class VehicleData(BaseModel):
    """Vehicle listing data"""
    year: int
    make: str
    model: str
    price: int
    mileage: Optional[int] = None
    vin: Optional[str] = None
    body_style: Optional[str] = None
    fuel_type: Optional[str] = None
    transmission: Optional[str] = None
    exterior_color: Optional[str] = None
    interior_color: Optional[str] = None
    description: Optional[str] = None
    location: str


class PostVehicleRequest(BaseModel):
    """Request to post a vehicle listing"""
    account_id: str
    vehicle: VehicleData
    photos: list[str] = Field(default_factory=list, description="Photo URLs")
    groups: list[str] = Field(default_factory=list, description="Group IDs to cross-post")


class SessionSetupRequest(BaseModel):
    """Request to set up a new session"""
    account_id: str
    email: str
    password: str
    totp_secret: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    timestamp: str
    redis_connected: bool
    workers_active: int
    browsers_active: int


# ========== Security Dependencies ==========

async def verify_api_key(
    request: Request,
    x_api_key: Annotated[Optional[str], Header()] = None,
    x_timestamp: Annotated[Optional[str], Header()] = None,
    x_nonce: Annotated[Optional[str], Header()] = None,
    x_signature: Annotated[Optional[str], Header()] = None,
):
    """
    Verify API key and optional request signature
    
    Supports two authentication modes:
    1. Simple API key (X-API-Key header)
    2. HMAC signature (X-Timestamp, X-Nonce, X-Signature headers)
    """
    settings = get_settings()
    monitor = get_security_monitor()
    client_ip = request.client.host if request.client else "unknown"
    
    # Mode 1: Simple API key authentication
    if x_api_key:
        if x_api_key != settings.worker_secret:
            await monitor.log_event(
                SecurityEventType.AUTH_FAILURE,
                source_ip=client_ip,
                details={"reason": "Invalid API key"},
                severity="high"
            )
            raise HTTPException(status_code=401, detail="Invalid API key")
        return x_api_key
    
    # Mode 2: HMAC signature authentication
    if x_signature and x_timestamp and x_nonce:
        auth_manager = getattr(request.app.state, "auth_manager", None)
        if not auth_manager:
            raise HTTPException(status_code=500, detail="Signature verification not configured")
        
        # Get request body for signature
        body = ""
        if request.method in ("POST", "PUT", "PATCH"):
            body = await request.body()
            body = body.decode() if body else ""
        
        is_valid = auth_manager.verify_request_signature(
            method=request.method,
            path=request.url.path,
            body=body,
            timestamp=x_timestamp,
            nonce=x_nonce,
            signature=x_signature
        )
        
        if not is_valid:
            await monitor.log_event(
                SecurityEventType.AUTH_FAILURE,
                source_ip=client_ip,
                details={"reason": "Invalid signature"},
                severity="high"
            )
            raise HTTPException(status_code=401, detail="Invalid request signature")
        
        return x_signature
    
    # No authentication provided
    await monitor.log_event(
        SecurityEventType.AUTH_FAILURE,
        source_ip=client_ip,
        details={"reason": "No authentication provided"},
        severity="medium"
    )
    raise HTTPException(status_code=401, detail="Authentication required")


async def validate_task_data(request: Request):
    """Validate task data in request body"""
    validator = get_input_validator()
    monitor = get_security_monitor()
    client_ip = request.client.host if request.client else "unknown"
    
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    
    is_valid, error = validator.validate_task_data(body)
    if not is_valid:
        await monitor.log_event(
            SecurityEventType.INVALID_INPUT,
            source_ip=client_ip,
            details={"error": error},
            severity="medium"
        )
        raise HTTPException(status_code=400, detail=error)
    
    return body


# ========== Endpoints ==========

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    redis = app.state.redis
    
    # Check Redis
    redis_ok = False
    try:
        await redis.ping()
        redis_ok = True
    except Exception:
        pass
    
    # Get worker stats
    workers = await redis.get_active_workers()
    browsers = await redis.get_browser_pool_stats()
    
    return HealthResponse(
        status="healthy" if redis_ok else "degraded",
        timestamp=datetime.utcnow().isoformat(),
        redis_connected=redis_ok,
        workers_active=len(workers),
        browsers_active=browsers.get('total', 0)
    )


@app.post("/api/tasks", response_model=TaskResponse, dependencies=[Depends(verify_api_key)])
async def create_task(task: TaskCreate):
    """
    Create a new automation task
    
    The task will be queued and processed by available workers.
    """
    redis = app.state.redis
    settings = get_settings()
    
    task_id = f"task_{uuid.uuid4().hex}"
    
    task_data = {
        'id': task_id,
        'type': task.type,
        'account_id': task.account_id,
        'data': task.data,
        'priority': task.priority,
        'created_at': datetime.utcnow().isoformat(),
        'retry_count': 0
    }
    
    await redis.enqueue_task(
        settings.task_queue_name,
        task_data,
        priority=task.priority
    )
    
    logger.info("Task created",
               task_id=task_id,
               type=task.type,
               account_id=task.account_id)
    
    return TaskResponse(
        task_id=task_id,
        status="queued",
        queued_at=task_data['created_at']
    )


@app.post("/api/post-vehicle", response_model=TaskResponse, dependencies=[Depends(verify_api_key)])
async def post_vehicle(request: PostVehicleRequest):
    """
    Create a vehicle listing task
    
    This is a convenience endpoint that creates a properly formatted
    post_vehicle task.
    """
    redis = app.state.redis
    settings = get_settings()
    
    task_id = f"vehicle_{uuid.uuid4().hex}"
    
    task_data = {
        'id': task_id,
        'type': 'post_vehicle',
        'account_id': request.account_id,
        'data': {
            'vehicle': request.vehicle.model_dump(),
            'photos': request.photos,
            'groups': request.groups
        },
        'priority': 'normal',
        'created_at': datetime.utcnow().isoformat(),
        'retry_count': 0
    }
    
    await redis.enqueue_task(
        settings.task_queue_name,
        task_data,
        priority='normal'
    )
    
    logger.info("Vehicle posting task created",
               task_id=task_id,
               account_id=request.account_id,
               make=request.vehicle.make,
               model=request.vehicle.model)
    
    return TaskResponse(
        task_id=task_id,
        status="queued",
        queued_at=task_data['created_at']
    )


@app.get("/api/tasks/{task_id}", dependencies=[Depends(verify_api_key)])
async def get_task_status(task_id: str):
    """Get status of a specific task"""
    redis = app.state.redis
    
    task_info = await redis.get_task_status(task_id)
    
    if not task_info:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return task_info


@app.get("/api/workers", dependencies=[Depends(verify_api_key)])
async def list_workers():
    """List all active workers"""
    redis = app.state.redis
    workers = await redis.get_active_workers()
    
    return {
        'workers': workers,
        'total': len(workers)
    }


@app.get("/api/workers/{worker_id}", dependencies=[Depends(verify_api_key)])
async def get_worker_details(worker_id: str):
    """Get detailed info about a specific worker"""
    redis = app.state.redis
    
    worker_info = await redis.get_worker_health(worker_id)
    
    if not worker_info:
        raise HTTPException(status_code=404, detail="Worker not found")
    
    return worker_info


@app.get("/api/sessions", dependencies=[Depends(verify_api_key)])
async def list_sessions():
    """List all stored Facebook sessions"""
    session_manager = app.state.session_manager
    
    sessions = await session_manager.list_sessions()
    
    return {
        'sessions': sessions,
        'total': len(sessions)
    }


@app.get("/api/sessions/{account_id}", dependencies=[Depends(verify_api_key)])
async def get_session_status(account_id: str):
    """Check if a session exists and is valid"""
    session_manager = app.state.session_manager
    
    is_valid = await session_manager.is_session_valid(account_id)
    
    return {
        'account_id': account_id,
        'has_session': is_valid,
        'checked_at': datetime.utcnow().isoformat()
    }


@app.delete("/api/sessions/{account_id}", dependencies=[Depends(verify_api_key)])
async def delete_session(account_id: str):
    """Delete a stored session"""
    session_manager = app.state.session_manager
    
    deleted = await session_manager.delete_session(account_id)
    
    return {
        'account_id': account_id,
        'deleted': deleted
    }


@app.post("/api/sessions/setup", dependencies=[Depends(verify_api_key)])
async def setup_session(
    request: SessionSetupRequest,
    background_tasks: BackgroundTasks
):
    """
    Initiate session setup for a Facebook account
    
    This will launch a browser to log in and capture the session.
    For accounts with 2FA, provide the TOTP secret for automatic code generation.
    """
    redis = app.state.redis
    settings = get_settings()
    
    # Create a session setup task
    task_id = f"setup_{uuid.uuid4().hex}"
    
    task_data = {
        'id': task_id,
        'type': 'setup_session',
        'account_id': request.account_id,
        'data': {
            'email': request.email,
            'password': request.password,
            'totp_secret': request.totp_secret
        },
        'priority': 'high',
        'created_at': datetime.utcnow().isoformat(),
        'retry_count': 0
    }
    
    await redis.enqueue_task(
        settings.task_queue_name,
        task_data,
        priority='high'
    )
    
    return {
        'task_id': task_id,
        'status': 'queued',
        'message': 'Session setup initiated. This may take a few minutes.'
    }


@app.get("/api/queue/stats", dependencies=[Depends(verify_api_key)])
async def get_queue_stats():
    """Get queue statistics"""
    redis = app.state.redis
    settings = get_settings()
    
    stats = await redis.get_queue_stats(settings.task_queue_name)
    
    return stats


@app.post("/api/queue/clear", dependencies=[Depends(verify_api_key)])
async def clear_queue():
    """Clear all pending tasks from the queue"""
    redis = app.state.redis
    settings = get_settings()
    
    cleared = await redis.clear_queue(settings.task_queue_name)
    
    return {
        'cleared': cleared,
        'queue': settings.task_queue_name
    }


# ========== Run ==========

def main():
    """Run the API server"""
    import uvicorn
    
    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer()
        ]
    )
    
    settings = get_settings()
    
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        workers=1
    )


if __name__ == '__main__':
    main()
