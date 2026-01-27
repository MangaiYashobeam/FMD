/**
 * ============================================
 * Enterprise Security Seed Data
 * ============================================
 * 
 * Seeds default SSRF protection configuration:
 * - Allowed domains for image proxy
 * - Blocked private IP ranges
 * - Default configuration
 */

import prisma from '../src/config/database';

async function seedEnterpriseSecurity() {
  console.log('🔐 Seeding Enterprise Security data...');

  // ============================================
  // Default Allowed Domains
  // ============================================
  const defaultDomains = [
    // Facebook CDN domains
    { domain: '.fbcdn.net', category: 'facebook', matchType: 'suffix', description: 'Facebook CDN' },
    { domain: '.fna.fbcdn.net', category: 'facebook', matchType: 'suffix', description: 'Facebook CDN (FNA)' },
    { domain: '.facebook.com', category: 'facebook', matchType: 'suffix', description: 'Facebook main domain' },
    { domain: '.fbsbx.com', category: 'facebook', matchType: 'suffix', description: 'Facebook sandbox' },
    { domain: 'scontent.fphx1-1.fna.fbcdn.net', category: 'facebook', matchType: 'exact', description: 'Facebook content server' },
    { domain: 'scontent.fphx1-2.fna.fbcdn.net', category: 'facebook', matchType: 'exact', description: 'Facebook content server' },
    { domain: 'external.fphx1-1.fna.fbcdn.net', category: 'facebook', matchType: 'exact', description: 'Facebook external content' },
    
    // AWS S3
    { domain: '.s3.amazonaws.com', category: 'aws', matchType: 'suffix', description: 'AWS S3 buckets' },
    { domain: '.s3.us-east-1.amazonaws.com', category: 'aws', matchType: 'suffix', description: 'AWS S3 US-East-1' },
    { domain: '.s3.us-west-2.amazonaws.com', category: 'aws', matchType: 'suffix', description: 'AWS S3 US-West-2' },
    { domain: '.cloudfront.net', category: 'aws', matchType: 'suffix', description: 'AWS CloudFront CDN' },
    
    // Cloudflare
    { domain: '.cloudflare.com', category: 'cloudflare', matchType: 'suffix', description: 'Cloudflare domains' },
    { domain: '.cloudflareimages.com', category: 'cloudflare', matchType: 'suffix', description: 'Cloudflare Images' },
    { domain: '.r2.cloudflarestorage.com', category: 'cloudflare', matchType: 'suffix', description: 'Cloudflare R2 Storage' },
    
    // Common CDNs
    { domain: '.googleusercontent.com', category: 'cdn', matchType: 'suffix', description: 'Google User Content' },
    { domain: '.imgur.com', category: 'cdn', matchType: 'suffix', description: 'Imgur CDN' },
    { domain: 'i.imgur.com', category: 'cdn', matchType: 'exact', description: 'Imgur image server' },
    { domain: '.cdninstagram.com', category: 'cdn', matchType: 'suffix', description: 'Instagram CDN' },
    
    // Dealer-specific domains
    { domain: 'dealersface.com', category: 'dealer', matchType: 'exact', description: 'Our production domain' },
    { domain: '.dealersface.com', category: 'dealer', matchType: 'suffix', description: 'Dealersface subdomains' },
    
    // Internal
    { domain: 'localhost', category: 'internal', matchType: 'exact', description: 'Local development only' },
  ];

  for (const domain of defaultDomains) {
    try {
      await prisma.ssrfAllowlistDomain.upsert({
        where: { domain: domain.domain },
        update: {
          category: domain.category,
          matchType: domain.matchType,
          description: domain.description,
        },
        create: {
          domain: domain.domain,
          category: domain.category,
          matchType: domain.matchType,
          description: domain.description,
          isActive: true,
          addedBy: 'system',
        },
      });
      console.log(`  ✅ Added domain: ${domain.domain}`);
    } catch (error) {
      console.log(`  ⚠️ Skipped domain: ${domain.domain}`);
    }
  }

  // ============================================
  // Default Blocked IP Prefixes
  // ============================================
  const defaultBlockedIPs = [
    // RFC 1918 Private addresses
    { ipPrefix: '10.', category: 'private', reason: 'RFC 1918 Class A private network (10.0.0.0/8)' },
    { ipPrefix: '172.16.', category: 'private', reason: 'RFC 1918 Class B private network start (172.16.0.0/12)' },
    { ipPrefix: '172.17.', category: 'private', reason: 'RFC 1918 Class B private network' },
    { ipPrefix: '172.18.', category: 'private', reason: 'RFC 1918 Class B private network' },
    { ipPrefix: '172.19.', category: 'private', reason: 'RFC 1918 Class B private network' },
    { ipPrefix: '172.20.', category: 'private', reason: 'RFC 1918 Class B private network' },
    { ipPrefix: '172.21.', category: 'private', reason: 'RFC 1918 Class B private network' },
    { ipPrefix: '172.22.', category: 'private', reason: 'RFC 1918 Class B private network' },
    { ipPrefix: '172.23.', category: 'private', reason: 'RFC 1918 Class B private network' },
    { ipPrefix: '172.24.', category: 'private', reason: 'RFC 1918 Class B private network' },
    { ipPrefix: '172.25.', category: 'private', reason: 'RFC 1918 Class B private network' },
    { ipPrefix: '172.26.', category: 'private', reason: 'RFC 1918 Class B private network' },
    { ipPrefix: '172.27.', category: 'private', reason: 'RFC 1918 Class B private network' },
    { ipPrefix: '172.28.', category: 'private', reason: 'RFC 1918 Class B private network' },
    { ipPrefix: '172.29.', category: 'private', reason: 'RFC 1918 Class B private network' },
    { ipPrefix: '172.30.', category: 'private', reason: 'RFC 1918 Class B private network' },
    { ipPrefix: '172.31.', category: 'private', reason: 'RFC 1918 Class B private network end' },
    { ipPrefix: '192.168.', category: 'private', reason: 'RFC 1918 Class C private network (192.168.0.0/16)' },
    
    // Loopback
    { ipPrefix: '127.', category: 'loopback', reason: 'Loopback address (127.0.0.0/8)' },
    { ipPrefix: '0.', category: 'loopback', reason: 'Current network (0.0.0.0/8)' },
    
    // Link-local
    { ipPrefix: '169.254.', category: 'linklocal', reason: 'Link-local addresses (169.254.0.0/16)' },
    
    // Cloud metadata endpoints
    { ipPrefix: '169.254.169.254', category: 'cloud_metadata', reason: 'AWS/GCP/Azure metadata endpoint' },
    { ipPrefix: '100.100.100.200', category: 'cloud_metadata', reason: 'Alibaba Cloud metadata endpoint' },
    { ipPrefix: 'fd00:', category: 'private', reason: 'IPv6 Unique local address' },
    { ipPrefix: 'fe80:', category: 'linklocal', reason: 'IPv6 Link-local address' },
    
    // Multicast and reserved
    { ipPrefix: '224.', category: 'custom', reason: 'Multicast addresses (224.0.0.0/4)' },
    { ipPrefix: '240.', category: 'custom', reason: 'Reserved for future use (240.0.0.0/4)' },
  ];

  for (const ip of defaultBlockedIPs) {
    try {
      await prisma.ssrfBlockedIP.upsert({
        where: { ipPrefix: ip.ipPrefix },
        update: {
          category: ip.category,
          reason: ip.reason,
        },
        create: {
          ipPrefix: ip.ipPrefix,
          category: ip.category,
          reason: ip.reason,
          isActive: true,
          addedBy: 'system',
        },
      });
      console.log(`  ✅ Added blocked IP: ${ip.ipPrefix}`);
    } catch (error) {
      console.log(`  ⚠️ Skipped IP: ${ip.ipPrefix}`);
    }
  }

  // ============================================
  // Default Configuration
  // ============================================
  try {
    const existingConfig = await prisma.enterpriseSecurityConfig.findFirst();
    
    if (!existingConfig) {
      await prisma.enterpriseSecurityConfig.create({
        data: {
          ssrfProtectionEnabled: true,
          privateIPBlockingEnabled: true,
          domainAllowlistEnabled: true,
          strictModeEnabled: false,
          auditLoggingEnabled: true,
          realTimeAlertsEnabled: true,
          maxRequestsPerMinute: 1000,
          blockDuration: 3600,
        },
      });
      console.log('  ✅ Created default security configuration');
    } else {
      console.log('  ✅ Security configuration already exists');
    }
  } catch (error) {
    console.error('  ❌ Failed to create security configuration:', error);
  }

  console.log('\n✅ Enterprise Security seed completed!');
  console.log(`   - ${defaultDomains.length} allowed domains`);
  console.log(`   - ${defaultBlockedIPs.length} blocked IP prefixes`);
  console.log('   - 1 security configuration');
}

// Run if called directly
if (require.main === module) {
  seedEnterpriseSecurity()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Seed failed:', error);
      process.exit(1);
    });
}

export { seedEnterpriseSecurity };
