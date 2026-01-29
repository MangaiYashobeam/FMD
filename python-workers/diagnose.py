#!/usr/bin/env python3
"""Test script to diagnose worker issues"""
import sys
import traceback

print("=== WORKER DIAGNOSTIC ===")

# Test imports
try:
    print("1. Testing imports...")
    from core.config import get_settings
    print("   - core.config OK")
    
    from core.redis_client import get_redis_queue
    print("   - core.redis_client OK")
    
    from browser.manager import BrowserPoolManager
    print("   - browser.manager OK")
    
    from workers.task_processor import TaskProcessor
    print("   - workers.task_processor OK")
    
    from workers.posting_worker import PostingWorker
    print("   - workers.posting_worker OK")
except Exception as e:
    print(f"   IMPORT ERROR: {e}")
    traceback.print_exc()
    sys.exit(1)

# Test config
try:
    print("\n2. Testing config...")
    settings = get_settings()
    print(f"   - task_queue_name: {settings.task_queue_name}")
    print(f"   - redis_url: {settings.redis_url}")
    print(f"   - max_concurrent_browsers: {settings.max_concurrent_browsers}")
except Exception as e:
    print(f"   CONFIG ERROR: {e}")
    traceback.print_exc()
    sys.exit(1)

# Test Redis connection
import asyncio

async def test_redis():
    print("\n3. Testing Redis connection...")
    try:
        redis = await get_redis_queue()
        print(f"   - Redis connected: {redis}")
        
        # Check queue length
        queue_name = settings.task_queue_name
        length = await redis.redis.llen(queue_name)
        print(f"   - Queue '{queue_name}' has {length} items")
        
        if length > 0:
            # Peek at first item
            item = await redis.redis.lindex(queue_name, 0)
            print(f"   - First item preview: {str(item)[:200]}...")
            
    except Exception as e:
        print(f"   REDIS ERROR: {e}")
        traceback.print_exc()
        return False
    return True

# Test worker initialization
async def test_worker():
    print("\n4. Testing worker initialization...")
    try:
        worker = PostingWorker()
        print(f"   - Worker ID: {worker.worker_id}")
        print(f"   - Worker created successfully")
    except Exception as e:
        print(f"   WORKER ERROR: {e}")
        traceback.print_exc()
        return False
    return True

async def main():
    await test_redis()
    await test_worker()
    print("\n=== DIAGNOSTIC COMPLETE ===")

asyncio.run(main())
