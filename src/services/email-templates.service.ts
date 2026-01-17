/**
 * Email Templates Service
 * 
 * Professional email templates with Dealers Face branding
 * for all system communications.
 */

// ============================================
// Branding Configuration
// ============================================

export const BRANDING = {
  companyName: 'Dealers Face',
  tagline: 'AI-Powered Automotive Social Commerce',
  logo: 'https://dealersface.com/logo.png',
  primaryColor: '#2563eb', // Blue-600
  secondaryColor: '#1e40af', // Blue-800
  accentColor: '#f59e0b', // Amber-500
  backgroundColor: '#f8fafc',
  textColor: '#1e293b',
  footerColor: '#64748b',
  supportEmail: 'support@dealersface.com',
  websiteUrl: 'https://dealersface.com',
  appUrl: process.env.FRONTEND_URL || 'https://fmd-production.up.railway.app',
};

// ============================================
// Base Email Template
// ============================================

export function baseTemplate(content: string, preheader?: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${BRANDING.companyName}</title>
  ${preheader ? `<span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</span>` : ''}
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: ${BRANDING.backgroundColor};
      color: ${BRANDING.textColor};
      line-height: 1.6;
    }
    
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .header {
      background: linear-gradient(135deg, ${BRANDING.primaryColor} 0%, ${BRANDING.secondaryColor} 100%);
      padding: 30px;
      text-align: center;
      border-radius: 12px 12px 0 0;
    }
    
    .header img {
      max-width: 180px;
      height: auto;
    }
    
    .header h1 {
      color: #ffffff;
      margin: 15px 0 5px;
      font-size: 24px;
      font-weight: 700;
    }
    
    .header p {
      color: rgba(255, 255, 255, 0.8);
      margin: 0;
      font-size: 14px;
    }
    
    .content {
      background: #ffffff;
      padding: 40px 30px;
      border-left: 1px solid #e2e8f0;
      border-right: 1px solid #e2e8f0;
    }
    
    .footer {
      background: #1e293b;
      padding: 30px;
      text-align: center;
      border-radius: 0 0 12px 12px;
    }
    
    .footer p {
      color: ${BRANDING.footerColor};
      margin: 5px 0;
      font-size: 12px;
    }
    
    .footer a {
      color: ${BRANDING.accentColor};
      text-decoration: none;
    }
    
    .btn {
      display: inline-block;
      padding: 14px 28px;
      background: ${BRANDING.primaryColor};
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
    }
    
    .btn-secondary {
      background: #64748b;
    }
    
    .btn-danger {
      background: #dc2626;
    }
    
    .btn-success {
      background: #16a34a;
    }
    
    .alert {
      padding: 16px 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    
    .alert-warning {
      background: #fef3c7;
      border-left: 4px solid ${BRANDING.accentColor};
      color: #92400e;
    }
    
    .alert-danger {
      background: #fee2e2;
      border-left: 4px solid #dc2626;
      color: #991b1b;
    }
    
    .alert-success {
      background: #dcfce7;
      border-left: 4px solid #16a34a;
      color: #166534;
    }
    
    .alert-info {
      background: #dbeafe;
      border-left: 4px solid ${BRANDING.primaryColor};
      color: #1e40af;
    }
    
    .stat-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      margin: 10px 0;
      text-align: center;
    }
    
    .stat-value {
      font-size: 32px;
      font-weight: 700;
      color: ${BRANDING.primaryColor};
    }
    
    .stat-label {
      font-size: 12px;
      color: ${BRANDING.footerColor};
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    
    .table th {
      background: #f1f5f9;
      padding: 12px 15px;
      text-align: left;
      font-size: 12px;
      text-transform: uppercase;
      color: ${BRANDING.footerColor};
      border-bottom: 2px solid #e2e8f0;
    }
    
    .table td {
      padding: 12px 15px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 14px;
    }
    
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .badge-success { background: #dcfce7; color: #166534; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    .badge-info { background: #dbeafe; color: #1e40af; }
    
    .divider {
      height: 1px;
      background: #e2e8f0;
      margin: 25px 0;
    }
    
    @media only screen and (max-width: 600px) {
      .container { padding: 10px; }
      .content { padding: 25px 20px; }
      .header { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${BRANDING.logo}" alt="${BRANDING.companyName}" onerror="this.style.display='none'">
      <h1>${BRANDING.companyName}</h1>
      <p>${BRANDING.tagline}</p>
    </div>
    
    <div class="content">
      ${content}
    </div>
    
    <div class="footer">
      <p><strong>${BRANDING.companyName}</strong></p>
      <p>${BRANDING.tagline}</p>
      <p style="margin-top: 15px;">
        <a href="${BRANDING.websiteUrl}">Website</a> • 
        <a href="${BRANDING.appUrl}">Dashboard</a> • 
        <a href="mailto:${BRANDING.supportEmail}">Support</a>
      </p>
      <p style="margin-top: 20px; font-size: 11px;">
        © ${new Date().getFullYear()} ${BRANDING.companyName}. All rights reserved.
      </p>
      <p style="font-size: 10px; color: #475569;">
        This email was sent from an automated system. Please do not reply directly.
      </p>
    </div>
  </div>
</body>
</html>
`;
}

// ============================================
// Security Email Templates
// ============================================

export const securityTemplates = {
  // Attack Detected Alert
  attackDetected: (data: {
    threatLevel: string;
    percentage: number;
    rps: number;
    timestamp: Date;
    blockedIPs: number;
    topAttackSources: { ip: string; requests: number }[];
  }) => baseTemplate(`
    <div class="alert alert-danger">
      <strong>🚨 SECURITY ALERT: Attack Detected</strong>
    </div>
    
    <h2 style="color: #dc2626; margin-top: 0;">Threat Level: ${data.threatLevel}</h2>
    
    <p>Our security system <strong>Intelliceil</strong> has detected abnormal traffic patterns that indicate a potential attack on the system.</p>
    
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 25px 0;">
      <div class="stat-card">
        <div class="stat-value" style="color: #dc2626;">${data.percentage.toFixed(1)}%</div>
        <div class="stat-label">Above Baseline</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.rps}</div>
        <div class="stat-label">Requests/Second</div>
      </div>
    </div>
    
    <h3>Top Attack Sources</h3>
    <table class="table">
      <tr>
        <th>IP Address</th>
        <th>Requests</th>
        <th>Action</th>
      </tr>
      ${data.topAttackSources.slice(0, 5).map(source => `
        <tr>
          <td><code>${source.ip}</code></td>
          <td>${source.requests}</td>
          <td><span class="badge badge-danger">Blocked</span></td>
        </tr>
      `).join('')}
    </table>
    
    <p><strong>Blocked IPs:</strong> ${data.blockedIPs} addresses have been automatically blocked.</p>
    
    <p><strong>Detected at:</strong> ${data.timestamp.toLocaleString()}</p>
    
    <div class="divider"></div>
    
    <p style="font-size: 14px; color: #64748b;">
      Intelliceil is automatically mitigating this attack. Trusted sources remain unaffected.
      Review the attack details in your dashboard.
    </p>
    
    <a href="${BRANDING.appUrl}/admin/intelliceil" class="btn btn-danger">View Security Dashboard</a>
  `, 'SECURITY ALERT: Attack detected on your system'),

  // Mitigation Activated
  mitigationActivated: (data: {
    timestamp: Date;
    threshold: number;
    currentLoad: number;
    estimatedDuration: string;
  }) => baseTemplate(`
    <div class="alert alert-warning">
      <strong>⚠️ Security Mitigation Activated</strong>
    </div>
    
    <h2 style="margin-top: 0;">Smart Mitigation Mode Enabled</h2>
    
    <p>Intelliceil has activated smart mitigation mode to protect your system from abnormal traffic.</p>
    
    <div class="stat-card">
      <div class="stat-value" style="color: #f59e0b;">${data.currentLoad.toFixed(1)}%</div>
      <div class="stat-label">Above Normal (Threshold: ${data.threshold}%)</div>
    </div>
    
    <h3>What This Means</h3>
    <ul>
      <li>✅ <strong>Trusted sources</strong> (Facebook, DMS systems, verified partners) continue uninterrupted</li>
      <li>✅ <strong>Verified users</strong> can access the system normally</li>
      <li>⚠️ <strong>Suspicious traffic</strong> is being filtered and analyzed</li>
      <li>🚫 <strong>Abnormal requests</strong> from unknown sources are temporarily blocked</li>
    </ul>
    
    <p><strong>Activated at:</strong> ${data.timestamp.toLocaleString()}</p>
    <p><strong>Estimated duration:</strong> ${data.estimatedDuration}</p>
    
    <a href="${BRANDING.appUrl}/admin/intelliceil" class="btn">Monitor Status</a>
  `, 'Security mitigation activated on Dealers Face'),

  // SQL Injection Attempt
  sqlInjectionAttempt: (data: {
    ip: string;
    endpoint: string;
    payload: string;
    timestamp: Date;
    blocked: boolean;
  }) => baseTemplate(`
    <div class="alert alert-danger">
      <strong>🛡️ SQL Injection Attempt Blocked</strong>
    </div>
    
    <h2 style="margin-top: 0;">Malicious Request Detected</h2>
    
    <p>A SQL injection attack was detected and blocked by Intelliceil.</p>
    
    <table class="table">
      <tr><td><strong>IP Address</strong></td><td><code>${data.ip}</code></td></tr>
      <tr><td><strong>Endpoint</strong></td><td><code>${data.endpoint}</code></td></tr>
      <tr><td><strong>Timestamp</strong></td><td>${data.timestamp.toLocaleString()}</td></tr>
      <tr><td><strong>Status</strong></td><td><span class="badge badge-${data.blocked ? 'success' : 'danger'}">${data.blocked ? 'BLOCKED' : 'NEEDS REVIEW'}</span></td></tr>
    </table>
    
    <div class="alert alert-info">
      <strong>Payload (sanitized):</strong><br>
      <code style="word-break: break-all;">${data.payload.substring(0, 200)}${data.payload.length > 200 ? '...' : ''}</code>
    </div>
    
    <a href="${BRANDING.appUrl}/admin/intelliceil?tab=blocked" class="btn btn-danger">Review Blocked IPs</a>
  `, 'SQL Injection attempt blocked'),

  // XSS Attack Attempt
  xssAttempt: (data: {
    ip: string;
    endpoint: string;
    payload: string;
    timestamp: Date;
    blocked: boolean;
  }) => baseTemplate(`
    <div class="alert alert-danger">
      <strong>🛡️ XSS Attack Attempt Blocked</strong>
    </div>
    
    <h2 style="margin-top: 0;">Cross-Site Scripting Detected</h2>
    
    <p>An XSS attack was detected and blocked by Intelliceil.</p>
    
    <table class="table">
      <tr><td><strong>IP Address</strong></td><td><code>${data.ip}</code></td></tr>
      <tr><td><strong>Endpoint</strong></td><td><code>${data.endpoint}</code></td></tr>
      <tr><td><strong>Timestamp</strong></td><td>${data.timestamp.toLocaleString()}</td></tr>
      <tr><td><strong>Status</strong></td><td><span class="badge badge-${data.blocked ? 'success' : 'danger'}">${data.blocked ? 'BLOCKED' : 'NEEDS REVIEW'}</span></td></tr>
    </table>
    
    <a href="${BRANDING.appUrl}/admin/intelliceil?tab=metrics" class="btn btn-danger">View Security Metrics</a>
  `, 'XSS attack attempt blocked'),

  // Bot Detection Alert
  botDetected: (data: {
    ip: string;
    userAgent: string;
    confidence: number;
    indicators: string[];
    timestamp: Date;
  }) => baseTemplate(`
    <div class="alert alert-warning">
      <strong>🤖 Bot Traffic Detected</strong>
    </div>
    
    <h2 style="margin-top: 0;">Automated Traffic Alert</h2>
    
    <p>Intelliceil has detected potential bot activity.</p>
    
    <div class="stat-card">
      <div class="stat-value" style="color: #f59e0b;">${data.confidence}%</div>
      <div class="stat-label">Bot Confidence Score</div>
    </div>
    
    <table class="table">
      <tr><td><strong>IP Address</strong></td><td><code>${data.ip}</code></td></tr>
      <tr><td><strong>User Agent</strong></td><td style="font-size: 12px;">${data.userAgent.substring(0, 100)}</td></tr>
      <tr><td><strong>Timestamp</strong></td><td>${data.timestamp.toLocaleString()}</td></tr>
    </table>
    
    <h3>Detection Indicators</h3>
    <ul>
      ${data.indicators.map(i => `<li>${i}</li>`).join('')}
    </ul>
    
    <a href="${BRANDING.appUrl}/admin/intelliceil" class="btn">Review in Dashboard</a>
  `, 'Bot traffic detected on Dealers Face'),

  // Honeypot Triggered
  honeypotTriggered: (data: {
    ip: string;
    endpoint: string;
    timestamp: Date;
  }) => baseTemplate(`
    <div class="alert alert-danger">
      <strong>🍯 Honeypot Trap Triggered</strong>
    </div>
    
    <h2 style="margin-top: 0;">Attacker Identified</h2>
    
    <p>An attacker attempted to access a honeypot endpoint and has been automatically blocked.</p>
    
    <table class="table">
      <tr><td><strong>IP Address</strong></td><td><code>${data.ip}</code></td></tr>
      <tr><td><strong>Attempted Endpoint</strong></td><td><code style="color: #dc2626;">${data.endpoint}</code></td></tr>
      <tr><td><strong>Timestamp</strong></td><td>${data.timestamp.toLocaleString()}</td></tr>
      <tr><td><strong>Action Taken</strong></td><td><span class="badge badge-danger">IP BLOCKED</span></td></tr>
    </table>
    
    <p style="color: #64748b; font-size: 14px;">
      This IP has been permanently added to the blocklist. The attacker was likely scanning for vulnerabilities.
    </p>
    
    <a href="${BRANDING.appUrl}/admin/intelliceil?tab=blocked" class="btn btn-danger">View Blocked IPs</a>
  `, 'Honeypot triggered - Attacker blocked'),

  // Daily Security Summary
  dailySecuritySummary: (data: {
    date: Date;
    totalRequests: number;
    blockedRequests: number;
    uniqueIPs: number;
    attacks: { type: string; count: number }[];
    topThreats: { ip: string; reason: string }[];
    threatLevel: string;
  }) => baseTemplate(`
    <h2 style="margin-top: 0;">📊 Daily Security Summary</h2>
    <p style="color: #64748b;">${data.date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 25px 0;">
      <div class="stat-card">
        <div class="stat-value">${data.totalRequests.toLocaleString()}</div>
        <div class="stat-label">Total Requests</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #dc2626;">${data.blockedRequests.toLocaleString()}</div>
        <div class="stat-label">Blocked</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.uniqueIPs}</div>
        <div class="stat-label">Unique IPs</div>
      </div>
    </div>
    
    <div class="alert alert-${data.threatLevel === 'NORMAL' ? 'success' : data.threatLevel === 'ELEVATED' ? 'warning' : 'danger'}">
      <strong>Current Threat Level:</strong> ${data.threatLevel}
    </div>
    
    ${data.attacks.length > 0 ? `
      <h3>Attack Summary</h3>
      <table class="table">
        <tr><th>Type</th><th>Count</th></tr>
        ${data.attacks.map(a => `<tr><td>${a.type}</td><td>${a.count}</td></tr>`).join('')}
      </table>
    ` : '<p style="color: #16a34a;">✅ No attacks detected today!</p>'}
    
    ${data.topThreats.length > 0 ? `
      <h3>Top Threats</h3>
      <table class="table">
        <tr><th>IP Address</th><th>Reason</th></tr>
        ${data.topThreats.slice(0, 5).map(t => `
          <tr><td><code>${t.ip}</code></td><td>${t.reason}</td></tr>
        `).join('')}
      </table>
    ` : ''}
    
    <a href="${BRANDING.appUrl}/admin/intelliceil" class="btn">View Full Report</a>
  `, `Security Summary: ${data.blockedRequests} threats blocked`),
};

// ============================================
// Report Email Templates
// ============================================

export const reportTemplates = {
  // Super Admin Weekly Report
  superAdminWeeklyReport: (data: {
    period: { start: Date; end: Date };
    accounts: {
      total: number;
      new: number;
      active: number;
      churned: number;
    };
    users: {
      total: number;
      new: number;
      active: number;
    };
    inventory: {
      totalVehicles: number;
      newListings: number;
      sold: number;
    };
    revenue: {
      mrr: number;
      newRevenue: number;
      growth: number;
    };
    facebook: {
      postsCreated: number;
      groupsConnected: number;
      reach: number;
    };
    security: {
      attacksBlocked: number;
      threatsDetected: number;
      uptime: number;
    };
    topAccounts: { name: string; posts: number; leads: number }[];
  }) => baseTemplate(`
    <h2 style="margin-top: 0;">📈 Weekly Platform Report</h2>
    <p style="color: #64748b;">
      ${data.period.start.toLocaleDateString()} - ${data.period.end.toLocaleDateString()}
    </p>
    
    <h3>💼 Account Overview</h3>
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0;">
      <div class="stat-card">
        <div class="stat-value">${data.accounts.total}</div>
        <div class="stat-label">Total Accounts</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #16a34a;">+${data.accounts.new}</div>
        <div class="stat-label">New This Week</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.accounts.active}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #dc2626;">${data.accounts.churned}</div>
        <div class="stat-label">Churned</div>
      </div>
    </div>
    
    <h3>👥 User Metrics</h3>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 20px 0;">
      <div class="stat-card">
        <div class="stat-value">${data.users.total}</div>
        <div class="stat-label">Total Users</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #16a34a;">+${data.users.new}</div>
        <div class="stat-label">New Users</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.users.active}</div>
        <div class="stat-label">Active Users</div>
      </div>
    </div>
    
    <h3>🚗 Inventory</h3>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 20px 0;">
      <div class="stat-card">
        <div class="stat-value">${data.inventory.totalVehicles.toLocaleString()}</div>
        <div class="stat-label">Total Vehicles</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #16a34a;">+${data.inventory.newListings}</div>
        <div class="stat-label">New Listings</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #2563eb;">${data.inventory.sold}</div>
        <div class="stat-label">Sold</div>
      </div>
    </div>
    
    <h3>💰 Revenue</h3>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 20px 0;">
      <div class="stat-card">
        <div class="stat-value">$${data.revenue.mrr.toLocaleString()}</div>
        <div class="stat-label">MRR</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #16a34a;">+$${data.revenue.newRevenue.toLocaleString()}</div>
        <div class="stat-label">New Revenue</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: ${data.revenue.growth >= 0 ? '#16a34a' : '#dc2626'};">${data.revenue.growth >= 0 ? '+' : ''}${data.revenue.growth}%</div>
        <div class="stat-label">Growth</div>
      </div>
    </div>
    
    <h3>📘 Facebook Integration</h3>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 20px 0;">
      <div class="stat-card">
        <div class="stat-value">${data.facebook.postsCreated}</div>
        <div class="stat-label">Posts Created</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.facebook.groupsConnected}</div>
        <div class="stat-label">Groups Connected</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.facebook.reach.toLocaleString()}</div>
        <div class="stat-label">Total Reach</div>
      </div>
    </div>
    
    <h3>🛡️ Security</h3>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 20px 0;">
      <div class="stat-card">
        <div class="stat-value">${data.security.attacksBlocked}</div>
        <div class="stat-label">Attacks Blocked</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.security.threatsDetected}</div>
        <div class="stat-label">Threats Detected</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #16a34a;">${data.security.uptime}%</div>
        <div class="stat-label">Uptime</div>
      </div>
    </div>
    
    <h3>🏆 Top Performing Accounts</h3>
    <table class="table">
      <tr><th>Account</th><th>Posts</th><th>Leads</th></tr>
      ${data.topAccounts.slice(0, 10).map(a => `
        <tr><td>${a.name}</td><td>${a.posts}</td><td>${a.leads}</td></tr>
      `).join('')}
    </table>
    
    <div class="divider"></div>
    
    <a href="${BRANDING.appUrl}/superadmin/analytics" class="btn">View Full Analytics</a>
  `, `Weekly Report: ${data.accounts.new} new accounts, $${data.revenue.newRevenue} revenue`),

  // Admin (Dealer) Weekly Report
  adminWeeklyReport: (data: {
    accountName: string;
    period: { start: Date; end: Date };
    inventory: {
      total: number;
      new: number;
      sold: number;
      pending: number;
    };
    facebook: {
      posts: number;
      reach: number;
      engagement: number;
      leads: number;
    };
    team: {
      totalUsers: number;
      activeUsers: number;
      topPerformer: { name: string; posts: number };
    };
    userStats: { name: string; posts: number; leads: number }[];
  }) => baseTemplate(`
    <h2 style="margin-top: 0;">📊 Weekly Report: ${data.accountName}</h2>
    <p style="color: #64748b;">
      ${data.period.start.toLocaleDateString()} - ${data.period.end.toLocaleDateString()}
    </p>
    
    <h3>🚗 Inventory Performance</h3>
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0;">
      <div class="stat-card">
        <div class="stat-value">${data.inventory.total}</div>
        <div class="stat-label">Total Vehicles</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #16a34a;">+${data.inventory.new}</div>
        <div class="stat-label">New Listings</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #2563eb;">${data.inventory.sold}</div>
        <div class="stat-label">Sold</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #f59e0b;">${data.inventory.pending}</div>
        <div class="stat-label">Pending</div>
      </div>
    </div>
    
    <h3>📘 Facebook Performance</h3>
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0;">
      <div class="stat-card">
        <div class="stat-value">${data.facebook.posts}</div>
        <div class="stat-label">Posts</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.facebook.reach.toLocaleString()}</div>
        <div class="stat-label">Reach</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.facebook.engagement}</div>
        <div class="stat-label">Engagement</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #16a34a;">${data.facebook.leads}</div>
        <div class="stat-label">Leads</div>
      </div>
    </div>
    
    <h3>👥 Team Performance</h3>
    <div class="alert alert-info">
      <strong>Top Performer:</strong> ${data.team.topPerformer.name} with ${data.team.topPerformer.posts} posts this week! 🏆
    </div>
    
    <table class="table">
      <tr><th>Team Member</th><th>Posts</th><th>Leads Generated</th></tr>
      ${data.userStats.map(u => `
        <tr><td>${u.name}</td><td>${u.posts}</td><td>${u.leads}</td></tr>
      `).join('')}
    </table>
    
    <div class="stat-card" style="background: linear-gradient(135deg, ${BRANDING.primaryColor}10 0%, ${BRANDING.secondaryColor}10 100%);">
      <p style="margin: 0; font-size: 14px;">
        <strong>${data.team.activeUsers}/${data.team.totalUsers}</strong> team members active this week
      </p>
    </div>
    
    <div class="divider"></div>
    
    <a href="${BRANDING.appUrl}/admin/analytics" class="btn">View Full Analytics</a>
  `, `Weekly Report: ${data.inventory.sold} vehicles sold, ${data.facebook.leads} leads`),

  // User Activity Report
  userActivityReport: (data: {
    userName: string;
    period: { start: Date; end: Date };
    activity: {
      postsCreated: number;
      vehiclesPosted: number;
      leadsGenerated: number;
      loginDays: number;
    };
    posts: { vehicle: string; date: Date; status: string }[];
    achievements: string[];
  }) => baseTemplate(`
    <h2 style="margin-top: 0;">📈 Your Activity Report</h2>
    <p>Hi ${data.userName},</p>
    <p style="color: #64748b;">
      Here's your performance summary for ${data.period.start.toLocaleDateString()} - ${data.period.end.toLocaleDateString()}
    </p>
    
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 25px 0;">
      <div class="stat-card">
        <div class="stat-value">${data.activity.postsCreated}</div>
        <div class="stat-label">Posts Created</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.activity.vehiclesPosted}</div>
        <div class="stat-label">Vehicles Posted</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #16a34a;">${data.activity.leadsGenerated}</div>
        <div class="stat-label">Leads Generated</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${data.activity.loginDays}</div>
        <div class="stat-label">Active Days</div>
      </div>
    </div>
    
    ${data.achievements.length > 0 ? `
      <div class="alert alert-success">
        <strong>🏆 Achievements Unlocked!</strong>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          ${data.achievements.map(a => `<li>${a}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
    
    <h3>Recent Posts</h3>
    <table class="table">
      <tr><th>Vehicle</th><th>Date</th><th>Status</th></tr>
      ${data.posts.slice(0, 10).map(p => `
        <tr>
          <td>${p.vehicle}</td>
          <td>${new Date(p.date).toLocaleDateString()}</td>
          <td><span class="badge badge-${p.status === 'published' ? 'success' : 'warning'}">${p.status}</span></td>
        </tr>
      `).join('')}
    </table>
    
    <div class="divider"></div>
    
    <p>Keep up the great work! 💪</p>
    
    <a href="${BRANDING.appUrl}/dashboard" class="btn">Go to Dashboard</a>
  `, `Your Weekly Summary: ${data.activity.postsCreated} posts, ${data.activity.leadsGenerated} leads`),
};

// ============================================
// Notification Email Templates
// ============================================

export const notificationTemplates = {
  // Welcome Email
  welcome: (data: { name: string; accountName: string; loginUrl: string; tempPassword?: string }) => baseTemplate(`
    <h2 style="margin-top: 0;">Welcome to ${BRANDING.companyName}! 🎉</h2>
    
    <p>Hi ${data.name},</p>
    
    <p>Your account has been created for <strong>${data.accountName}</strong>. You're now part of the most powerful automotive social commerce platform.</p>
    
    ${data.tempPassword ? `
      <div class="alert alert-info">
        <strong>Your temporary password:</strong><br>
        <code style="font-size: 18px; letter-spacing: 2px;">${data.tempPassword}</code>
        <p style="margin: 10px 0 0; font-size: 12px;">Please change this password after your first login.</p>
      </div>
    ` : ''}
    
    <h3>What you can do:</h3>
    <ul>
      <li>📘 Connect your Facebook account and groups</li>
      <li>🚗 Post vehicles to multiple groups with one click</li>
      <li>📊 Track engagement and leads</li>
      <li>🤖 Let AI generate compelling descriptions</li>
    </ul>
    
    <a href="${data.loginUrl}" class="btn">Login to Your Account</a>
    
    <div class="divider"></div>
    
    <p style="font-size: 14px; color: #64748b;">
      Need help getting started? Check out our <a href="${BRANDING.websiteUrl}/docs">documentation</a> or contact <a href="mailto:${BRANDING.supportEmail}">support</a>.
    </p>
  `, `Welcome to ${BRANDING.companyName}!`),

  // Password Reset
  passwordReset: (data: { name: string; resetUrl: string; expiresIn: string }) => baseTemplate(`
    <h2 style="margin-top: 0;">Password Reset Request</h2>
    
    <p>Hi ${data.name},</p>
    
    <p>We received a request to reset your password. Click the button below to set a new password:</p>
    
    <a href="${data.resetUrl}" class="btn">Reset Password</a>
    
    <div class="alert alert-warning">
      <strong>This link expires in ${data.expiresIn}.</strong>
      <p style="margin: 5px 0 0;">If you didn't request this reset, you can safely ignore this email.</p>
    </div>
    
    <p style="font-size: 14px; color: #64748b;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <code style="word-break: break-all;">${data.resetUrl}</code>
    </p>
  `, 'Password Reset Request'),

  // Account Subscription Updated
  subscriptionUpdated: (data: {
    accountName: string;
    plan: string;
    amount: number;
    nextBilling: Date;
    features: string[];
  }) => baseTemplate(`
    <h2 style="margin-top: 0;">Subscription Updated ✅</h2>
    
    <p>Great news! Your subscription for <strong>${data.accountName}</strong> has been updated.</p>
    
    <div class="stat-card">
      <div class="stat-value">${data.plan}</div>
      <div class="stat-label">Your Plan</div>
    </div>
    
    <table class="table">
      <tr><td><strong>Monthly Amount</strong></td><td>$${data.amount.toFixed(2)}</td></tr>
      <tr><td><strong>Next Billing Date</strong></td><td>${data.nextBilling.toLocaleDateString()}</td></tr>
    </table>
    
    <h3>Your Plan Includes:</h3>
    <ul>
      ${data.features.map(f => `<li>✅ ${f}</li>`).join('')}
    </ul>
    
    <a href="${BRANDING.appUrl}/admin/billing" class="btn">Manage Subscription</a>
  `, `Subscription Updated: ${data.plan}`),

  // New Lead Notification
  newLead: (data: {
    vehicleName: string;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    source: string;
    message?: string;
  }) => baseTemplate(`
    <h2 style="margin-top: 0;">🔔 New Lead Received!</h2>
    
    <div class="alert alert-success">
      <strong>Someone is interested in:</strong> ${data.vehicleName}
    </div>
    
    <h3>Customer Information</h3>
    <table class="table">
      <tr><td><strong>Name</strong></td><td>${data.customerName}</td></tr>
      ${data.customerPhone ? `<tr><td><strong>Phone</strong></td><td><a href="tel:${data.customerPhone}">${data.customerPhone}</a></td></tr>` : ''}
      ${data.customerEmail ? `<tr><td><strong>Email</strong></td><td><a href="mailto:${data.customerEmail}">${data.customerEmail}</a></td></tr>` : ''}
      <tr><td><strong>Source</strong></td><td><span class="badge badge-info">${data.source}</span></td></tr>
    </table>
    
    ${data.message ? `
      <h3>Message</h3>
      <div class="alert alert-info">
        "${data.message}"
      </div>
    ` : ''}
    
    <a href="${BRANDING.appUrl}/leads" class="btn btn-success">View All Leads</a>
  `, `New Lead: ${data.customerName} interested in ${data.vehicleName}`),

  // Welcome Email with Plan Details
  welcomeWithPlan: (data: {
    userName: string;
    dealershipName: string;
    planName: string;
    planPrice: number;
    planInterval: 'monthly' | 'lifetime';
    features: string[];
    trialDays?: number;
    lifetimeDuration?: number;
  }) => baseTemplate(`
    <h2 style="margin-top: 0;">Welcome to Dealers Face! 🎉</h2>
    
    <p>Hello ${data.userName},</p>
    
    <p>Congratulations! <strong>${data.dealershipName}</strong> is now set up and ready to dominate Facebook Marketplace.</p>
    
    <div class="stat-card" style="background: linear-gradient(135deg, ${BRANDING.primaryColor}, ${BRANDING.secondaryColor}); color: white;">
      <div class="stat-value" style="color: white;">${data.planName}</div>
      <div class="stat-label" style="color: rgba(255,255,255,0.9);">Your Plan</div>
    </div>
    
    <table class="table">
      <tr>
        <td><strong>Investment</strong></td>
        <td>$${data.planPrice.toLocaleString()}${data.planInterval === 'lifetime' ? ' (one-time)' : '/month'}</td>
      </tr>
      ${data.lifetimeDuration ? `
      <tr>
        <td><strong>Access Duration</strong></td>
        <td>${data.lifetimeDuration} Years Unlimited Access</td>
      </tr>
      ` : ''}
      ${data.trialDays ? `
      <tr>
        <td><strong>Trial Period</strong></td>
        <td>${data.trialDays} days free trial</td>
      </tr>
      ` : ''}
    </table>
    
    <h3>Your Plan Includes:</h3>
    <ul style="list-style: none; padding: 0;">
      ${data.features.map(f => `<li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">✅ ${f}</li>`).join('')}
    </ul>
    
    <h3>Quick Start Guide:</h3>
    <ol>
      <li><strong>Install Chrome Extension</strong> - Add your Facebook accounts</li>
      <li><strong>Connect Your DMS</strong> - Auto-sync your inventory</li>
      <li><strong>Configure Posting</strong> - Set up your listing templates</li>
      <li><strong>Start Posting</strong> - Watch leads flow in!</li>
    </ol>
    
    <a href="${BRANDING.appUrl}/dashboard" class="btn">Go to Dashboard</a>
    
    <p style="margin-top: 30px; color: #64748b; font-size: 14px;">
      Need help getting started? Our support team is here for you.<br>
      <a href="mailto:${BRANDING.supportEmail}">${BRANDING.supportEmail}</a>
    </p>
  `, `Welcome to Dealers Face - Your ${data.planName} plan is active!`),

  // Lifetime Subscription Confirmation
  lifetimeSubscriptionConfirmed: (data: {
    userName: string;
    dealershipName: string;
    amountPaid: number;
    durationYears: number;
    expirationDate: Date;
    savingsAmount: number;
    savingsPercent: number;
    renewalPrice: number;
  }) => baseTemplate(`
    <h2 style="margin-top: 0;">Enterprise Lifetime Purchase Confirmed! 🌟</h2>
    
    <p>Dear ${data.userName},</p>
    
    <p>Thank you for your trust in Dealers Face! Your <strong>Enterprise Lifetime</strong> subscription for <strong>${data.dealershipName}</strong> is now active.</p>
    
    <div class="alert alert-success" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; border: none;">
      <h3 style="margin: 0 0 10px 0; color: white;">🏆 You're a VIP Member!</h3>
      <p style="margin: 0; color: rgba(255,255,255,0.95);">
        You've locked in ${data.durationYears} years of unlimited access and saved <strong>$${data.savingsAmount.toLocaleString()}</strong> (${data.savingsPercent}%)!
      </p>
    </div>
    
    <table class="table">
      <tr>
        <td><strong>Amount Paid</strong></td>
        <td style="font-size: 18px; font-weight: bold; color: ${BRANDING.primaryColor};">$${data.amountPaid.toLocaleString()}</td>
      </tr>
      <tr>
        <td><strong>Access Duration</strong></td>
        <td>${data.durationYears} Years Unlimited</td>
      </tr>
      <tr>
        <td><strong>Valid Through</strong></td>
        <td>${data.expirationDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
      </tr>
      <tr>
        <td><strong>Total Savings</strong></td>
        <td style="color: #16a34a; font-weight: bold;">$${data.savingsAmount.toLocaleString()} (${data.savingsPercent}%)</td>
      </tr>
    </table>
    
    <h3>What Happens After ${data.durationYears} Years?</h3>
    <p>Your subscription will automatically continue at our Pro rate of <strong>$${data.renewalPrice.toLocaleString()}/month</strong>. You'll receive a reminder 90 days before your lifetime access expires.</p>
    
    <h3>Your VIP Benefits:</h3>
    <ul style="list-style: none; padding: 0;">
      <li style="padding: 8px 0;">🚀 Unlimited posting accounts</li>
      <li style="padding: 8px 0;">👥 Unlimited users - no extra fees ever</li>
      <li style="padding: 8px 0;">⭐ Priority feature requests</li>
      <li style="padding: 8px 0;">📞 VIP support with executive escalation</li>
      <li style="padding: 8px 0;">📊 Quarterly business reviews</li>
    </ul>
    
    <a href="${BRANDING.appUrl}/dashboard" class="btn btn-success">Access Your Dashboard</a>
  `, `Enterprise Lifetime Confirmed - $${data.savingsAmount.toLocaleString()} Saved!`),

  // Subscription Upgrade Confirmation
  subscriptionUpgraded: (data: {
    userName: string;
    dealershipName: string;
    previousPlan: string;
    newPlan: string;
    previousPrice: number;
    newPrice: number;
    newFeatures: string[];
    effectiveDate: Date;
    prorationAmount?: number;
  }) => baseTemplate(`
    <h2 style="margin-top: 0;">Subscription Upgraded! ⬆️</h2>
    
    <p>Hello ${data.userName},</p>
    
    <p>Great news! Your subscription for <strong>${data.dealershipName}</strong> has been upgraded.</p>
    
    <div style="display: flex; align-items: center; justify-content: center; gap: 20px; margin: 30px 0;">
      <div class="stat-card" style="opacity: 0.7;">
        <div class="stat-value" style="font-size: 16px;">${data.previousPlan}</div>
        <div class="stat-label">Previous</div>
      </div>
      <span style="font-size: 24px;">→</span>
      <div class="stat-card" style="background: linear-gradient(135deg, ${BRANDING.primaryColor}, ${BRANDING.secondaryColor}); color: white;">
        <div class="stat-value" style="color: white; font-size: 16px;">${data.newPlan}</div>
        <div class="stat-label" style="color: rgba(255,255,255,0.9);">Current</div>
      </div>
    </div>
    
    <table class="table">
      <tr>
        <td><strong>Previous Price</strong></td>
        <td style="text-decoration: line-through; color: #94a3b8;">$${data.previousPrice.toLocaleString()}/mo</td>
      </tr>
      <tr>
        <td><strong>New Price</strong></td>
        <td style="font-weight: bold; color: ${BRANDING.primaryColor};">$${data.newPrice.toLocaleString()}/mo</td>
      </tr>
      ${data.prorationAmount ? `
      <tr>
        <td><strong>Prorated Charge</strong></td>
        <td>$${data.prorationAmount.toFixed(2)}</td>
      </tr>
      ` : ''}
      <tr>
        <td><strong>Effective</strong></td>
        <td>${data.effectiveDate.toLocaleDateString()}</td>
      </tr>
    </table>
    
    <h3>New Features Unlocked:</h3>
    <ul style="list-style: none; padding: 0;">
      ${data.newFeatures.map(f => `<li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">🔓 ${f}</li>`).join('')}
    </ul>
    
    <a href="${BRANDING.appUrl}/admin/billing" class="btn">View Billing Details</a>
  `, `Upgraded to ${data.newPlan}!`),

  // Subscription Downgrade Notice
  subscriptionDowngraded: (data: {
    userName: string;
    dealershipName: string;
    previousPlan: string;
    newPlan: string;
    previousPrice: number;
    newPrice: number;
    effectiveDate: Date;
    lostFeatures: string[];
  }) => baseTemplate(`
    <h2 style="margin-top: 0;">Subscription Plan Changed ⬇️</h2>
    
    <p>Hello ${data.userName},</p>
    
    <p>Your subscription for <strong>${data.dealershipName}</strong> has been changed as requested.</p>
    
    <table class="table">
      <tr>
        <td><strong>Previous Plan</strong></td>
        <td>${data.previousPlan} ($${data.previousPrice.toLocaleString()}/mo)</td>
      </tr>
      <tr>
        <td><strong>New Plan</strong></td>
        <td>${data.newPlan} ($${data.newPrice.toLocaleString()}/mo)</td>
      </tr>
      <tr>
        <td><strong>Effective Date</strong></td>
        <td>${data.effectiveDate.toLocaleDateString()}</td>
      </tr>
      <tr>
        <td><strong>Monthly Savings</strong></td>
        <td style="color: #16a34a;">$${(data.previousPrice - data.newPrice).toLocaleString()}/mo</td>
      </tr>
    </table>
    
    ${data.lostFeatures.length > 0 ? `
    <div class="alert alert-warning">
      <strong>⚠️ Features No Longer Available:</strong>
      <ul style="margin: 10px 0 0 0; padding-left: 20px;">
        ${data.lostFeatures.map(f => `<li>${f}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    
    <p>Changed your mind? You can upgrade anytime from your billing settings.</p>
    
    <a href="${BRANDING.appUrl}/admin/billing" class="btn">Manage Subscription</a>
  `, `Subscription Changed to ${data.newPlan}`),

  // Invoice/Receipt Email
  invoiceReceipt: (data: {
    userName: string;
    dealershipName: string;
    invoiceNumber: string;
    invoiceDate: Date;
    planName: string;
    items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
    subtotal: number;
    tax?: number;
    total: number;
    paymentMethod: string;
    nextBillingDate?: Date;
    downloadUrl?: string;
  }) => baseTemplate(`
    <h2 style="margin-top: 0;">Invoice Receipt 📄</h2>
    
    <p>Hello ${data.userName},</p>
    
    <p>Thank you for your payment! Here's your receipt for <strong>${data.dealershipName}</strong>.</p>
    
    <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 5px 0;"><strong>Invoice #</strong></td>
          <td style="text-align: right;">${data.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;"><strong>Date</strong></td>
          <td style="text-align: right;">${data.invoiceDate.toLocaleDateString()}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;"><strong>Plan</strong></td>
          <td style="text-align: right;">${data.planName}</td>
        </tr>
      </table>
    </div>
    
    <table class="table">
      <thead>
        <tr style="background: #f1f5f9;">
          <th style="padding: 12px; text-align: left;">Description</th>
          <th style="padding: 12px; text-align: center;">Qty</th>
          <th style="padding: 12px; text-align: right;">Price</th>
          <th style="padding: 12px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${data.items.map(item => `
          <tr>
            <td style="padding: 12px;">${item.description}</td>
            <td style="padding: 12px; text-align: center;">${item.quantity}</td>
            <td style="padding: 12px; text-align: right;">$${item.unitPrice.toLocaleString()}</td>
            <td style="padding: 12px; text-align: right;">$${item.total.toLocaleString()}</td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="padding: 12px; text-align: right;"><strong>Subtotal</strong></td>
          <td style="padding: 12px; text-align: right;">$${data.subtotal.toLocaleString()}</td>
        </tr>
        ${data.tax ? `
        <tr>
          <td colspan="3" style="padding: 12px; text-align: right;">Tax</td>
          <td style="padding: 12px; text-align: right;">$${data.tax.toFixed(2)}</td>
        </tr>
        ` : ''}
        <tr style="background: ${BRANDING.primaryColor}; color: white;">
          <td colspan="3" style="padding: 12px; text-align: right;"><strong>Total Paid</strong></td>
          <td style="padding: 12px; text-align: right; font-size: 18px;"><strong>$${data.total.toLocaleString()}</strong></td>
        </tr>
      </tfoot>
    </table>
    
    <p style="color: #64748b; font-size: 14px;">
      <strong>Payment Method:</strong> ${data.paymentMethod}
    </p>
    
    ${data.nextBillingDate ? `
    <p style="color: #64748b; font-size: 14px;">
      <strong>Next Billing Date:</strong> ${data.nextBillingDate.toLocaleDateString()}
    </p>
    ` : ''}
    
    ${data.downloadUrl ? `
    <a href="${data.downloadUrl}" class="btn">Download PDF Invoice</a>
    ` : ''}
    
    <a href="${BRANDING.appUrl}/admin/billing" class="btn btn-secondary" style="margin-left: 10px;">View Billing History</a>
  `, `Invoice #${data.invoiceNumber} - $${data.total.toLocaleString()}`),

  // Payment Failed Alert
  paymentFailed: (data: {
    userName: string;
    dealershipName: string;
    planName: string;
    amount: number;
    failureReason?: string;
    retryDate?: Date;
    updatePaymentUrl: string;
  }) => baseTemplate(`
    <h2 style="margin-top: 0; color: #dc2626;">⚠️ Payment Failed</h2>
    
    <p>Hello ${data.userName},</p>
    
    <p>We were unable to process the payment for <strong>${data.dealershipName}</strong>'s subscription.</p>
    
    <div class="alert alert-danger">
      <strong>Payment Details:</strong>
      <ul style="margin: 10px 0 0 0; padding-left: 20px;">
        <li>Plan: ${data.planName}</li>
        <li>Amount: $${data.amount.toLocaleString()}</li>
        ${data.failureReason ? `<li>Reason: ${data.failureReason}</li>` : ''}
      </ul>
    </div>
    
    <p><strong>What happens next?</strong></p>
    <ul>
      <li>Your account remains active for now</li>
      ${data.retryDate ? `<li>We'll retry the payment on ${data.retryDate.toLocaleDateString()}</li>` : ''}
      <li>Please update your payment method to avoid service interruption</li>
    </ul>
    
    <a href="${data.updatePaymentUrl}" class="btn btn-danger">Update Payment Method</a>
    
    <p style="margin-top: 20px; color: #64748b; font-size: 14px;">
      If you believe this is an error, please contact us at <a href="mailto:${BRANDING.supportEmail}">${BRANDING.supportEmail}</a>
    </p>
  `, `Action Required: Payment Failed for ${data.dealershipName}`),

  // Subscription Cancellation Confirmation
  subscriptionCancelled: (data: {
    userName: string;
    dealershipName: string;
    planName: string;
    endDate: Date;
    reason?: string;
  }) => baseTemplate(`
    <h2 style="margin-top: 0;">Subscription Cancelled 😢</h2>
    
    <p>Hello ${data.userName},</p>
    
    <p>We're sorry to see you go! Your subscription for <strong>${data.dealershipName}</strong> has been cancelled.</p>
    
    <div class="alert alert-info">
      <strong>Important:</strong> Your access continues until <strong>${data.endDate.toLocaleDateString()}</strong>
    </div>
    
    <table class="table">
      <tr>
        <td><strong>Plan</strong></td>
        <td>${data.planName}</td>
      </tr>
      <tr>
        <td><strong>Access Until</strong></td>
        <td>${data.endDate.toLocaleDateString()}</td>
      </tr>
    </table>
    
    <p>We'd love to hear why you're leaving. Your feedback helps us improve.</p>
    
    <p><strong>Changed your mind?</strong> You can reactivate your subscription anytime before ${data.endDate.toLocaleDateString()}.</p>
    
    <a href="${BRANDING.appUrl}/admin/billing" class="btn">Reactivate Subscription</a>
    
    <p style="margin-top: 30px; color: #64748b; font-size: 14px;">
      Thank you for being a Dealers Face customer. We hope to see you again!
    </p>
  `, `Subscription Cancelled - Access until ${data.endDate.toLocaleDateString()}`),

  // Lifetime Subscription Expiring Reminder (90 days before)
  lifetimeExpiringReminder: (data: {
    userName: string;
    dealershipName: string;
    expirationDate: Date;
    daysRemaining: number;
    renewalPlan: string;
    renewalPrice: number;
  }) => baseTemplate(`
    <h2 style="margin-top: 0;">Your Lifetime Access is Expiring Soon ⏰</h2>
    
    <p>Hello ${data.userName},</p>
    
    <p>Your Enterprise Lifetime subscription for <strong>${data.dealershipName}</strong> will expire in <strong>${data.daysRemaining} days</strong>.</p>
    
    <div class="stat-card" style="background: #fef3c7;">
      <div class="stat-value" style="color: #d97706;">${data.daysRemaining}</div>
      <div class="stat-label" style="color: #92400e;">Days Remaining</div>
    </div>
    
    <table class="table">
      <tr>
        <td><strong>Expiration Date</strong></td>
        <td>${data.expirationDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
      </tr>
      <tr>
        <td><strong>After Expiration</strong></td>
        <td>Continues as ${data.renewalPlan} @ $${data.renewalPrice.toLocaleString()}/month</td>
      </tr>
    </table>
    
    <h3>What Happens Next?</h3>
    <ul>
      <li>Your subscription will automatically continue at the Pro monthly rate</li>
      <li>All your data, settings, and accounts remain intact</li>
      <li>No action required - we'll charge your saved payment method</li>
    </ul>
    
    <p>Want to purchase another lifetime access period? Contact our sales team!</p>
    
    <a href="${BRANDING.appUrl}/admin/billing" class="btn">Review Billing Settings</a>
    <a href="mailto:sales@dealersface.com" class="btn btn-secondary" style="margin-left: 10px;">Contact Sales</a>
  `, `Lifetime Access Expiring in ${data.daysRemaining} Days`),

  // Extra User Charge Notification
  extraUserCharge: (data: {
    userName: string;
    dealershipName: string;
    planName: string;
    includedUsers: number;
    currentUsers: number;
    extraUsers: number;
    extraUserRate: number;
    totalExtraCharge: number;
  }) => baseTemplate(`
    <h2 style="margin-top: 0;">Additional User Charges 👥</h2>
    
    <p>Hello ${data.userName},</p>
    
    <p>Your account <strong>${data.dealershipName}</strong> has exceeded the included user limit for your ${data.planName} plan.</p>
    
    <table class="table">
      <tr>
        <td><strong>Your Plan</strong></td>
        <td>${data.planName}</td>
      </tr>
      <tr>
        <td><strong>Included Users</strong></td>
        <td>${data.includedUsers}</td>
      </tr>
      <tr>
        <td><strong>Current Users</strong></td>
        <td>${data.currentUsers}</td>
      </tr>
      <tr>
        <td><strong>Extra Users</strong></td>
        <td>${data.extraUsers}</td>
      </tr>
      <tr>
        <td><strong>Extra User Rate</strong></td>
        <td>$${data.extraUserRate}/user/month</td>
      </tr>
      <tr style="background: #fef3c7;">
        <td><strong>Additional Charge</strong></td>
        <td style="font-weight: bold;">$${data.totalExtraCharge.toLocaleString()}/month</td>
      </tr>
    </table>
    
    <p><strong>💡 Tip:</strong> ${data.planName === 'Starter' 
      ? 'Upgrade to Growth ($1,199/mo) for 25 users at $100/extra user, or upgrade to Pro for unlimited users!' 
      : 'Upgrade to Pro ($2,999/mo) for unlimited users with no extra fees!'
    }</p>
    
    <a href="${BRANDING.appUrl}/admin/billing" class="btn">Manage Subscription</a>
    <a href="${BRANDING.appUrl}/admin/team" class="btn btn-secondary" style="margin-left: 10px;">Manage Team</a>
  `, `Additional User Charges: ${data.extraUsers} extra users`),
};

// Export all templates
export const emailTemplates = {
  security: securityTemplates,
  reports: reportTemplates,
  notifications: notificationTemplates,
  base: baseTemplate,
  branding: BRANDING,
};

export default emailTemplates;
