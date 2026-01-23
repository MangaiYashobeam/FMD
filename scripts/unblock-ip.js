#!/usr/bin/env node

/**
 * Emergency IP Unblock Script
 * Unblocks an IP from all security systems
 */

const ip = process.argv[2] || '86.40.131.65';

console.log(`🔓 Unblocking IP: ${ip}`);

// Method 1: Clear from Intelliceil memory (runtime)
async function unblockFromIntelliceil() {
  try {
    const { intelliceilService } = require('../dist/services/intelliceil.service.js');
    
    if (intelliceilService && typeof intelliceilService.manualUnblock === 'function') {
      intelliceilService.manualUnblock(ip);
      console.log(`✅ Unblocked ${ip} from Intelliceil`);
      return true;
    } else {
      console.log('⚠️  Intelliceil service not available or no manualUnblock method');
      return false;
    }
  } catch (error) {
    console.error('❌ Error unblocking from Intelliceil:', error.message);
    return false;
  }
}

// Method 2: Clear rate limits from Redis
async function clearRateLimits() {
  try {
    const { createClient } = require('redis');
    const client = createClient({
      url: process.env.REDIS_URL || 'redis://redis:6379',
    });
    
    await client.connect();
    console.log('🔌 Connected to Redis');
    
    // Clear all rate limit keys for this IP
    const patterns = [
      `rate-limit:*:${ip}`,
      `rl:*:${ip}`,
      `limiter:*:${ip}`,
      `intelliceil:blocked:${ip}`,
      `intelliceil:ip:${ip}`,
    ];
    
    let totalCleared = 0;
    
    for (const pattern of patterns) {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        console.log(`🔑 Found ${keys.length} keys matching ${pattern}`);
        for (const key of keys) {
          await client.del(key);
          totalCleared++;
        }
      }
    }
    
    await client.disconnect();
    console.log(`✅ Cleared ${totalCleared} Redis keys for ${ip}`);
    return true;
  } catch (error) {
    console.error('❌ Error clearing Redis:', error.message);
    return false;
  }
}

// Method 3: Whitelist in IIPC service
async function whitelistInIIPC() {
  try {
    const { iipcService } = require('../dist/services/iipc.service.js');
    
    if (iipcService && typeof iipcService.addSuperAdminIP === 'function') {
      iipcService.addSuperAdminIP(ip);
      console.log(`✅ Added ${ip} to IIPC super admin list`);
      return true;
    } else {
      console.log('⚠️  IIPC service not available');
      return false;
    }
  } catch (error) {
    console.error('❌ Error whitelisting in IIPC:', error.message);
    return false;
  }
}

// Run all methods
async function main() {
  console.log('━'.repeat(60));
  console.log('🚨 EMERGENCY IP UNBLOCK SCRIPT');
  console.log('━'.repeat(60));
  
  const results = await Promise.all([
    unblockFromIntelliceil(),
    clearRateLimits(),
    whitelistInIIPC(),
  ]);
  
  console.log('━'.repeat(60));
  
  const successCount = results.filter(r => r).length;
  
  if (successCount === results.length) {
    console.log(`✅ SUCCESS: IP ${ip} fully unblocked!`);
    console.log('You can now access the system.');
  } else if (successCount > 0) {
    console.log(`⚠️  PARTIAL SUCCESS: ${successCount}/${results.length} methods succeeded`);
    console.log('IP may still have some restrictions. Try again.');
  } else {
    console.log(`❌ FAILED: Could not unblock IP ${ip}`);
    console.log('Manual intervention required.');
  }
  
  console.log('━'.repeat(60));
  process.exit(successCount > 0 ? 0 : 1);
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
