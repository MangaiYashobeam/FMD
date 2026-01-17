/**
 * PDF Generation Service
 * 
 * Professional PDF generation for:
 * - Reports (Super Admin, Admin, User)
 * - Security Reports
 * - Invoices
 * 
 * Uses PDFKit - a free, lightweight Node.js library
 */

import PDFDocument from 'pdfkit';
import { BRANDING } from './email-templates.service';

// ============================================
// Types
// ============================================

export interface PDFReportData {
  title: string;
  subtitle?: string;
  period?: { start: Date; end: Date };
  generatedAt: Date;
  sections: PDFSection[];
}

export interface PDFSection {
  title: string;
  type: 'stats' | 'table' | 'chart' | 'text' | 'divider';
  data?: any;
}

export interface PDFStatCard {
  label: string;
  value: string | number;
  change?: number;
  color?: string;
}

export interface PDFTableData {
  headers: string[];
  rows: (string | number)[][];
  widths?: number[];
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  company: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    email: string;
    phone?: string;
  };
  customer: {
    name: string;
    email: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  notes?: string;
  paymentTerms?: string;
  status: 'paid' | 'pending' | 'overdue';
}

// ============================================
// Color Palette (Dealers Face Branding)
// ============================================

const COLORS = {
  primary: '#2563eb',
  secondary: '#1e40af',
  accent: '#f59e0b',
  success: '#16a34a',
  warning: '#f59e0b',
  danger: '#dc2626',
  text: '#1e293b',
  textLight: '#64748b',
  textMuted: '#94a3b8',
  background: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
  headerBg: '#1e293b',
};

// ============================================
// PDF Service Class
// ============================================

class PDFService {
  private createDocument(): PDFKit.PDFDocument {
    return new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: 'Dealers Face Report',
        Author: BRANDING.companyName,
        Creator: BRANDING.companyName,
      },
    });
  }

  // ============================================
  // Header & Footer
  // ============================================

  private drawHeader(doc: PDFKit.PDFDocument, title: string, subtitle?: string): void {
    const pageWidth = doc.page.width;
    const marginLeft = doc.page.margins.left;
    const marginRight = doc.page.margins.right;
    const contentWidth = pageWidth - marginLeft - marginRight;

    // Header background
    doc.rect(0, 0, pageWidth, 100)
       .fill(COLORS.headerBg);

    // Logo placeholder (circle with initials)
    doc.circle(marginLeft + 25, 50, 20)
       .fill(COLORS.primary);
    
    doc.fontSize(14)
       .fillColor(COLORS.white)
       .text('DF', marginLeft + 14, 43);

    // Company name
    doc.fontSize(20)
       .fillColor(COLORS.white)
       .text('Dealers Face', marginLeft + 55, 35);
    
    doc.fontSize(10)
       .fillColor(COLORS.textMuted)
       .text(BRANDING.tagline, marginLeft + 55, 58);

    // Title on the right
    doc.fontSize(16)
       .fillColor(COLORS.white)
       .text(title, marginLeft, 35, { width: contentWidth, align: 'right' });
    
    if (subtitle) {
      doc.fontSize(10)
         .fillColor(COLORS.textMuted)
         .text(subtitle, marginLeft, 55, { width: contentWidth, align: 'right' });
    }

    // Reset position
    doc.y = 120;
    doc.fillColor(COLORS.text);
  }

  private drawFooter(doc: PDFKit.PDFDocument, pageNumber: number): void {
    const pageWidth = doc.page.width;
    const marginLeft = doc.page.margins.left;
    const marginRight = doc.page.margins.right;
    const contentWidth = pageWidth - marginLeft - marginRight;
    const footerY = doc.page.height - 40;

    // Footer line
    doc.strokeColor(COLORS.border)
       .lineWidth(1)
       .moveTo(marginLeft, footerY - 10)
       .lineTo(pageWidth - marginRight, footerY - 10)
       .stroke();

    // Footer text
    doc.fontSize(8)
       .fillColor(COLORS.textMuted)
       .text(`${BRANDING.companyName} | ${BRANDING.websiteUrl}`, marginLeft, footerY, { width: contentWidth / 2 })
       .text(`Page ${pageNumber}`, marginLeft + contentWidth / 2, footerY, { width: contentWidth / 2, align: 'right' });
  }

  // ============================================
  // Stat Cards (Grid of metrics)
  // ============================================

  private drawStatCards(doc: PDFKit.PDFDocument, cards: PDFStatCard[], columns: number = 4): void {
    const marginLeft = doc.page.margins.left;
    const contentWidth = doc.page.width - marginLeft - doc.page.margins.right;
    const cardWidth = (contentWidth - (columns - 1) * 15) / columns;
    const cardHeight = 70;
    const startY = doc.y;

    cards.forEach((card, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = marginLeft + col * (cardWidth + 15);
      const y = startY + row * (cardHeight + 15);

      // Card background
      doc.roundedRect(x, y, cardWidth, cardHeight, 8)
         .fill(COLORS.background);

      // Value
      const valueColor = card.color || COLORS.primary;
      doc.fontSize(24)
         .fillColor(valueColor)
         .text(String(card.value), x + 10, y + 12, { width: cardWidth - 20, align: 'center' });

      // Label
      doc.fontSize(9)
         .fillColor(COLORS.textLight)
         .text(card.label.toUpperCase(), x + 10, y + 45, { width: cardWidth - 20, align: 'center' });

      // Change indicator
      if (card.change !== undefined) {
        const changeColor = card.change >= 0 ? COLORS.success : COLORS.danger;
        const changeText = card.change >= 0 ? `+${card.change}%` : `${card.change}%`;
        doc.fontSize(8)
           .fillColor(changeColor)
           .text(changeText, x + cardWidth - 40, y + 8);
      }
    });

    // Update Y position
    const totalRows = Math.ceil(cards.length / columns);
    doc.y = startY + totalRows * (cardHeight + 15) + 10;
  }

  // ============================================
  // Tables
  // ============================================

  private drawTable(doc: PDFKit.PDFDocument, data: PDFTableData): void {
    const marginLeft = doc.page.margins.left;
    const contentWidth = doc.page.width - marginLeft - doc.page.margins.right;
    const colCount = data.headers.length;
    const defaultColWidth = contentWidth / colCount;
    const colWidths = data.widths || data.headers.map(() => defaultColWidth);
    const rowHeight = 30;
    const headerHeight = 35;
    let startY = doc.y;

    // Header
    doc.rect(marginLeft, startY, contentWidth, headerHeight)
       .fill('#f1f5f9');

    let x = marginLeft;
    data.headers.forEach((header, i) => {
      doc.fontSize(9)
         .fillColor(COLORS.textLight)
         .text(header.toUpperCase(), x + 10, startY + 12, { width: colWidths[i] - 20 });
      x += colWidths[i];
    });

    startY += headerHeight;

    // Rows
    data.rows.forEach((row, rowIndex) => {
      // Check if we need a new page
      if (startY + rowHeight > doc.page.height - 60) {
        doc.addPage();
        this.drawHeader(doc, 'Report Continued', '');
        startY = doc.y;
      }

      // Alternate row background
      if (rowIndex % 2 === 1) {
        doc.rect(marginLeft, startY, contentWidth, rowHeight)
           .fill('#fafafa');
      }

      // Row border
      doc.strokeColor(COLORS.border)
         .lineWidth(0.5)
         .moveTo(marginLeft, startY + rowHeight)
         .lineTo(marginLeft + contentWidth, startY + rowHeight)
         .stroke();

      // Cell values
      x = marginLeft;
      row.forEach((cell, i) => {
        doc.fontSize(10)
           .fillColor(COLORS.text)
           .text(String(cell), x + 10, startY + 9, { width: colWidths[i] - 20 });
        x += colWidths[i];
      });

      startY += rowHeight;
    });

    doc.y = startY + 20;
  }

  // ============================================
  // Section Title
  // ============================================

  private drawSectionTitle(doc: PDFKit.PDFDocument, title: string, icon?: string): void {
    const marginLeft = doc.page.margins.left;
    
    // Icon circle
    doc.circle(marginLeft + 8, doc.y + 6, 8)
       .fill(COLORS.primary);
    
    if (icon) {
      doc.fontSize(10)
         .fillColor(COLORS.white)
         .text(icon, marginLeft + 4, doc.y + 1);
    }

    // Title
    doc.fontSize(14)
       .fillColor(COLORS.text)
       .text(title, marginLeft + 25, doc.y - 3);
    
    doc.y += 15;
  }

  // ============================================
  // Divider
  // ============================================

  private drawDivider(doc: PDFKit.PDFDocument): void {
    const marginLeft = doc.page.margins.left;
    const contentWidth = doc.page.width - marginLeft - doc.page.margins.right;
    
    doc.strokeColor(COLORS.border)
       .lineWidth(1)
       .moveTo(marginLeft, doc.y)
       .lineTo(marginLeft + contentWidth, doc.y)
       .stroke();
    
    doc.y += 20;
  }

  // ============================================
  // Progress Bar (kept for future use)
  // ============================================

  // @ts-ignore - Kept for future use
  private _drawProgressBar(doc: PDFKit.PDFDocument, label: string, value: number, max: number = 100, color: string = COLORS.primary): void {
    const marginLeft = doc.page.margins.left;
    const contentWidth = doc.page.width - marginLeft - doc.page.margins.right;
    const barWidth = contentWidth - 150;
    const barHeight = 12;
    const percentage = Math.min(value / max, 1);

    // Label
    doc.fontSize(10)
       .fillColor(COLORS.text)
       .text(label, marginLeft, doc.y);

    // Value
    doc.text(`${value.toLocaleString()} / ${max.toLocaleString()}`, marginLeft + contentWidth - 100, doc.y - 12, { width: 100, align: 'right' });

    // Background bar
    doc.roundedRect(marginLeft, doc.y + 5, barWidth, barHeight, 6)
       .fill(COLORS.border);

    // Progress bar
    if (percentage > 0) {
      doc.roundedRect(marginLeft, doc.y + 5, barWidth * percentage, barHeight, 6)
         .fill(color);
    }

    doc.y += barHeight + 15;
  }

  // ============================================
  // Alert Box
  // ============================================

  private drawAlertBox(doc: PDFKit.PDFDocument, message: string, type: 'info' | 'success' | 'warning' | 'danger' = 'info'): void {
    const marginLeft = doc.page.margins.left;
    const contentWidth = doc.page.width - marginLeft - doc.page.margins.right;
    
    const colors = {
      info: { bg: '#dbeafe', border: COLORS.primary, text: '#1e40af' },
      success: { bg: '#dcfce7', border: COLORS.success, text: '#166534' },
      warning: { bg: '#fef3c7', border: COLORS.warning, text: '#92400e' },
      danger: { bg: '#fee2e2', border: COLORS.danger, text: '#991b1b' },
    };
    const c = colors[type];

    // Background
    doc.roundedRect(marginLeft, doc.y, contentWidth, 40, 4)
       .fill(c.bg);

    // Left border accent
    doc.rect(marginLeft, doc.y, 4, 40)
       .fill(c.border);

    // Text
    doc.fontSize(10)
       .fillColor(c.text)
       .text(message, marginLeft + 15, doc.y + 13, { width: contentWidth - 30 });

    doc.y += 55;
  }

  // ============================================
  // Generate Super Admin Report PDF
  // ============================================

  async generateSuperAdminReport(data: {
    period: { start: Date; end: Date };
    accounts: { total: number; new: number; active: number; churned: number };
    users: { total: number; new: number; active: number };
    inventory: { totalVehicles: number; newListings: number; sold: number };
    revenue: { mrr: number; newRevenue: number; growth: number };
    facebook: { postsCreated: number; groupsConnected: number; reach: number };
    security: { attacksBlocked: number; threatsDetected: number; uptime: number };
    topAccounts: { name: string; posts: number; leads: number }[];
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = this.createDocument();
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const periodStr = `${data.period.start.toLocaleDateString()} - ${data.period.end.toLocaleDateString()}`;

        // Page 1 - Overview
        this.drawHeader(doc, 'Platform Report', periodStr);

        // Summary Alert
        this.drawAlertBox(doc, `Report Period: ${periodStr} | Generated: ${new Date().toLocaleString()}`, 'info');

        // Account Stats
        this.drawSectionTitle(doc, 'Account Overview', '📊');
        this.drawStatCards(doc, [
          { label: 'Total Accounts', value: data.accounts.total },
          { label: 'New This Period', value: `+${data.accounts.new}`, color: COLORS.success },
          { label: 'Active Accounts', value: data.accounts.active },
          { label: 'Churned', value: data.accounts.churned, color: COLORS.danger },
        ]);

        // User Stats
        this.drawSectionTitle(doc, 'User Metrics', '👥');
        this.drawStatCards(doc, [
          { label: 'Total Users', value: data.users.total },
          { label: 'New Users', value: `+${data.users.new}`, color: COLORS.success },
          { label: 'Active Users', value: data.users.active },
          { label: 'Active Rate', value: `${((data.users.active / data.users.total) * 100).toFixed(1)}%` },
        ]);

        // Inventory Stats
        this.drawSectionTitle(doc, 'Inventory Performance', '🚗');
        this.drawStatCards(doc, [
          { label: 'Total Vehicles', value: data.inventory.totalVehicles.toLocaleString() },
          { label: 'New Listings', value: `+${data.inventory.newListings}`, color: COLORS.success },
          { label: 'Sold', value: data.inventory.sold, color: COLORS.primary },
          { label: 'Conversion', value: `${((data.inventory.sold / data.inventory.newListings) * 100 || 0).toFixed(1)}%` },
        ]);

        // Page 2 - Revenue & Facebook
        doc.addPage();
        this.drawHeader(doc, 'Platform Report', 'Revenue & Social');

        // Revenue
        this.drawSectionTitle(doc, 'Revenue Metrics', '💰');
        this.drawStatCards(doc, [
          { label: 'Monthly Recurring', value: `$${data.revenue.mrr.toLocaleString()}` },
          { label: 'New Revenue', value: `+$${data.revenue.newRevenue.toLocaleString()}`, color: COLORS.success },
          { label: 'Growth', value: `${data.revenue.growth >= 0 ? '+' : ''}${data.revenue.growth}%`, color: data.revenue.growth >= 0 ? COLORS.success : COLORS.danger },
        ], 3);

        this.drawDivider(doc);

        // Facebook Stats
        this.drawSectionTitle(doc, 'Facebook Integration', '📘');
        this.drawStatCards(doc, [
          { label: 'Posts Created', value: data.facebook.postsCreated },
          { label: 'Groups Connected', value: data.facebook.groupsConnected },
          { label: 'Total Reach', value: data.facebook.reach.toLocaleString() },
        ], 3);

        this.drawDivider(doc);

        // Security Stats
        this.drawSectionTitle(doc, 'Security Overview', '🛡️');
        this.drawStatCards(doc, [
          { label: 'Attacks Blocked', value: data.security.attacksBlocked, color: COLORS.danger },
          { label: 'Threats Detected', value: data.security.threatsDetected, color: COLORS.warning },
          { label: 'System Uptime', value: `${data.security.uptime}%`, color: COLORS.success },
        ], 3);

        // Top Accounts Table
        if (data.topAccounts.length > 0) {
          doc.y += 10;
          this.drawSectionTitle(doc, 'Top Performing Accounts', '🏆');
          this.drawTable(doc, {
            headers: ['Rank', 'Account Name', 'Posts', 'Leads'],
            rows: data.topAccounts.slice(0, 10).map((a, i) => [
              `#${i + 1}`,
              a.name,
              a.posts,
              a.leads,
            ]),
            widths: [50, 250, 80, 80],
          });
        }

        // Footer on all pages
        const pageCount = doc.bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
          doc.switchToPage(i);
          this.drawFooter(doc, i + 1);
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // ============================================
  // Generate Admin (Dealer) Report PDF
  // ============================================

  async generateAdminReport(data: {
    accountName: string;
    period: { start: Date; end: Date };
    inventory: { total: number; new: number; sold: number; pending: number };
    facebook: { posts: number; reach: number; engagement: number; leads: number };
    team: { totalUsers: number; activeUsers: number; topPerformer: { name: string; posts: number } };
    userStats: { name: string; posts: number; leads: number }[];
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = this.createDocument();
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const periodStr = `${data.period.start.toLocaleDateString()} - ${data.period.end.toLocaleDateString()}`;

        // Header
        this.drawHeader(doc, data.accountName, `Weekly Report | ${periodStr}`);

        // Summary
        this.drawAlertBox(doc, `Report for ${data.accountName} | Period: ${periodStr}`, 'info');

        // Inventory Stats
        this.drawSectionTitle(doc, 'Inventory Performance', '🚗');
        this.drawStatCards(doc, [
          { label: 'Total Vehicles', value: data.inventory.total },
          { label: 'New Listings', value: `+${data.inventory.new}`, color: COLORS.success },
          { label: 'Sold', value: data.inventory.sold, color: COLORS.primary },
          { label: 'Pending', value: data.inventory.pending, color: COLORS.warning },
        ]);

        // Facebook Stats
        this.drawSectionTitle(doc, 'Facebook Performance', '📘');
        this.drawStatCards(doc, [
          { label: 'Posts', value: data.facebook.posts },
          { label: 'Reach', value: data.facebook.reach.toLocaleString() },
          { label: 'Engagement', value: data.facebook.engagement },
          { label: 'Leads', value: data.facebook.leads, color: COLORS.success },
        ]);

        // Top Performer Alert
        if (data.team.topPerformer.posts > 0) {
          this.drawAlertBox(doc, `🏆 Top Performer: ${data.team.topPerformer.name} with ${data.team.topPerformer.posts} posts this period!`, 'success');
        }

        // Team Stats
        this.drawSectionTitle(doc, 'Team Performance', '👥');
        this.drawStatCards(doc, [
          { label: 'Total Team', value: data.team.totalUsers },
          { label: 'Active Members', value: data.team.activeUsers, color: COLORS.success },
          { label: 'Activity Rate', value: `${((data.team.activeUsers / data.team.totalUsers) * 100).toFixed(0)}%` },
        ], 3);

        // User Stats Table
        if (data.userStats.length > 0) {
          this.drawSectionTitle(doc, 'Team Member Breakdown', '📊');
          this.drawTable(doc, {
            headers: ['Team Member', 'Posts Created', 'Leads Generated'],
            rows: data.userStats.map(u => [u.name, u.posts, u.leads]),
            widths: [200, 120, 120],
          });
        }

        // Footer
        const pageCount = doc.bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
          doc.switchToPage(i);
          this.drawFooter(doc, i + 1);
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // ============================================
  // Generate User Activity Report PDF
  // ============================================

  async generateUserReport(data: {
    userName: string;
    period: { start: Date; end: Date };
    activity: { postsCreated: number; vehiclesPosted: number; leadsGenerated: number; loginDays: number };
    posts: { vehicle: string; date: Date; status: string }[];
    achievements: string[];
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = this.createDocument();
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const periodStr = `${data.period.start.toLocaleDateString()} - ${data.period.end.toLocaleDateString()}`;

        // Header
        this.drawHeader(doc, `Activity Report`, `${data.userName} | ${periodStr}`);

        // Welcome message
        doc.fontSize(12)
           .fillColor(COLORS.text)
           .text(`Hi ${data.userName},`, doc.page.margins.left, doc.y)
           .fontSize(10)
           .fillColor(COLORS.textLight)
           .text(`Here's your activity summary for ${periodStr}`, doc.page.margins.left, doc.y + 5);
        
        doc.y += 30;

        // Activity Stats
        this.drawSectionTitle(doc, 'Your Activity', '📈');
        this.drawStatCards(doc, [
          { label: 'Posts Created', value: data.activity.postsCreated },
          { label: 'Vehicles Posted', value: data.activity.vehiclesPosted },
          { label: 'Leads Generated', value: data.activity.leadsGenerated, color: COLORS.success },
          { label: 'Active Days', value: data.activity.loginDays },
        ]);

        // Achievements
        if (data.achievements.length > 0) {
          this.drawSectionTitle(doc, 'Achievements Unlocked!', '🏆');
          data.achievements.forEach(achievement => {
            this.drawAlertBox(doc, achievement, 'success');
          });
        }

        // Recent Posts Table
        if (data.posts.length > 0) {
          this.drawSectionTitle(doc, 'Recent Posts', '📝');
          this.drawTable(doc, {
            headers: ['Vehicle', 'Date', 'Status'],
            rows: data.posts.slice(0, 10).map(p => [
              p.vehicle,
              new Date(p.date).toLocaleDateString(),
              p.status.toUpperCase(),
            ]),
            widths: [250, 100, 100],
          });
        }

        // Motivational message
        doc.y += 20;
        this.drawAlertBox(doc, 'Keep up the great work! Your contributions help drive success. 💪', 'info');

        // Footer
        const pageCount = doc.bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
          doc.switchToPage(i);
          this.drawFooter(doc, i + 1);
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // ============================================
  // Generate Security Report PDF
  // ============================================

  async generateSecurityReport(data: {
    date: Date;
    totalRequests: number;
    blockedRequests: number;
    uniqueIPs: number;
    attacks: { type: string; count: number }[];
    topThreats: { ip: string; reason: string }[];
    threatLevel: string;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = this.createDocument();
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        this.drawHeader(doc, 'Security Report', `Intelliceil | ${data.date.toLocaleDateString()}`);

        // Threat Level Alert
        const threatColors: Record<string, 'success' | 'warning' | 'danger'> = {
          NORMAL: 'success',
          ELEVATED: 'warning',
          HIGH: 'danger',
          CRITICAL: 'danger',
        };
        this.drawAlertBox(doc, `Current Threat Level: ${data.threatLevel}`, threatColors[data.threatLevel] || 'info');

        // Overview Stats
        this.drawSectionTitle(doc, 'Traffic Overview', '📊');
        this.drawStatCards(doc, [
          { label: 'Total Requests', value: data.totalRequests.toLocaleString() },
          { label: 'Blocked Requests', value: data.blockedRequests.toLocaleString(), color: COLORS.danger },
          { label: 'Unique IPs', value: data.uniqueIPs },
          { label: 'Block Rate', value: `${((data.blockedRequests / data.totalRequests) * 100).toFixed(2)}%` },
        ]);

        // Attack Summary
        if (data.attacks.length > 0) {
          this.drawSectionTitle(doc, 'Attack Summary', '🛡️');
          this.drawTable(doc, {
            headers: ['Attack Type', 'Count', 'Severity'],
            rows: data.attacks.map(a => [
              a.type,
              a.count,
              a.count > 100 ? 'HIGH' : a.count > 10 ? 'MEDIUM' : 'LOW',
            ]),
            widths: [200, 100, 100],
          });
        } else {
          this.drawAlertBox(doc, '✅ No attacks detected during this period!', 'success');
        }

        // Top Threats
        if (data.topThreats.length > 0) {
          this.drawSectionTitle(doc, 'Top Threats', '⚠️');
          this.drawTable(doc, {
            headers: ['IP Address', 'Reason'],
            rows: data.topThreats.slice(0, 10).map(t => [t.ip, t.reason]),
            widths: [150, 300],
          });
        }

        // Footer
        const pageCount = doc.bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
          doc.switchToPage(i);
          this.drawFooter(doc, i + 1);
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // ============================================
  // Generate Invoice PDF
  // ============================================

  async generateInvoice(data: InvoiceData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = this.createDocument();
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const marginLeft = doc.page.margins.left;
        const marginRight = doc.page.margins.right;
        const pageWidth = doc.page.width;
        const contentWidth = pageWidth - marginLeft - marginRight;

        // Header with Invoice branding
        doc.rect(0, 0, pageWidth, 120)
           .fill(COLORS.headerBg);

        // Logo
        doc.circle(marginLeft + 25, 60, 20)
           .fill(COLORS.primary);
        doc.fontSize(14)
           .fillColor(COLORS.white)
           .text('DF', marginLeft + 14, 53);

        doc.fontSize(24)
           .fillColor(COLORS.white)
           .text('INVOICE', marginLeft + 55, 45);
        
        doc.fontSize(10)
           .fillColor(COLORS.textMuted)
           .text(data.company.name, marginLeft + 55, 72);

        // Invoice number & date on right
        doc.fontSize(10)
           .fillColor(COLORS.white)
           .text(`Invoice #: ${data.invoiceNumber}`, marginLeft, 45, { width: contentWidth, align: 'right' })
           .text(`Date: ${data.invoiceDate.toLocaleDateString()}`, marginLeft, 60, { width: contentWidth, align: 'right' })
           .text(`Due: ${data.dueDate.toLocaleDateString()}`, marginLeft, 75, { width: contentWidth, align: 'right' });

        // Status badge
        const statusColors: Record<string, string> = {
          paid: COLORS.success,
          pending: COLORS.warning,
          overdue: COLORS.danger,
        };
        doc.roundedRect(pageWidth - marginRight - 60, 92, 60, 20, 4)
           .fill(statusColors[data.status]);
        doc.fontSize(9)
           .fillColor(COLORS.white)
           .text(data.status.toUpperCase(), pageWidth - marginRight - 55, 97, { width: 50, align: 'center' });

        doc.y = 140;

        // From / To Section
        const halfWidth = contentWidth / 2 - 10;

        // From
        doc.fontSize(10)
           .fillColor(COLORS.textLight)
           .text('FROM', marginLeft, doc.y);
        doc.y += 15;
        doc.fontSize(11)
           .fillColor(COLORS.text)
           .text(data.company.name, marginLeft, doc.y);
        doc.fontSize(9)
           .fillColor(COLORS.textLight)
           .text(data.company.address, marginLeft, doc.y += 15)
           .text(`${data.company.city}, ${data.company.state} ${data.company.zip}`, marginLeft, doc.y += 12)
           .text(data.company.email, marginLeft, doc.y += 12);
        if (data.company.phone) {
          doc.text(data.company.phone, marginLeft, doc.y += 12);
        }

        // To
        const toStartY = 140;
        doc.fontSize(10)
           .fillColor(COLORS.textLight)
           .text('BILL TO', marginLeft + halfWidth + 20, toStartY);
        doc.fontSize(11)
           .fillColor(COLORS.text)
           .text(data.customer.name, marginLeft + halfWidth + 20, toStartY + 15);
        doc.fontSize(9)
           .fillColor(COLORS.textLight)
           .text(data.customer.email, marginLeft + halfWidth + 20, toStartY + 30);
        if (data.customer.address) {
          doc.text(data.customer.address, marginLeft + halfWidth + 20, toStartY + 42);
          doc.text(`${data.customer.city}, ${data.customer.state} ${data.customer.zip}`, marginLeft + halfWidth + 20, toStartY + 54);
        }

        doc.y = Math.max(doc.y, toStartY + 70) + 30;

        // Items Table
        const colWidths = [280, 60, 80, 80];
        let tableY = doc.y;

        // Table Header
        doc.rect(marginLeft, tableY, contentWidth, 30)
           .fill('#f1f5f9');

        let x = marginLeft;
        ['Description', 'Qty', 'Unit Price', 'Total'].forEach((header, i) => {
          doc.fontSize(9)
             .fillColor(COLORS.textLight)
             .text(header.toUpperCase(), x + 10, tableY + 10, { width: colWidths[i] - 20, align: i > 0 ? 'right' : 'left' });
          x += colWidths[i];
        });

        tableY += 30;

        // Table Rows
        data.items.forEach((item, index) => {
          if (index % 2 === 1) {
            doc.rect(marginLeft, tableY, contentWidth, 35)
               .fill('#fafafa');
          }

          x = marginLeft;
          const values = [
            item.description,
            item.quantity.toString(),
            `$${item.unitPrice.toFixed(2)}`,
            `$${item.total.toFixed(2)}`,
          ];

          values.forEach((val, i) => {
            doc.fontSize(10)
               .fillColor(COLORS.text)
               .text(val, x + 10, tableY + 12, { width: colWidths[i] - 20, align: i > 0 ? 'right' : 'left' });
            x += colWidths[i];
          });

          // Border
          doc.strokeColor(COLORS.border)
             .lineWidth(0.5)
             .moveTo(marginLeft, tableY + 35)
             .lineTo(marginLeft + contentWidth, tableY + 35)
             .stroke();

          tableY += 35;
        });

        // Totals
        tableY += 20;
        const totalsX = marginLeft + contentWidth - 200;

        // Subtotal
        doc.fontSize(10)
           .fillColor(COLORS.textLight)
           .text('Subtotal:', totalsX, tableY, { width: 100 })
           .fillColor(COLORS.text)
           .text(`$${data.subtotal.toFixed(2)}`, totalsX + 100, tableY, { width: 100, align: 'right' });

        // Tax
        tableY += 20;
        doc.fillColor(COLORS.textLight)
           .text(`Tax (${data.taxRate}%):`, totalsX, tableY, { width: 100 })
           .fillColor(COLORS.text)
           .text(`$${data.tax.toFixed(2)}`, totalsX + 100, tableY, { width: 100, align: 'right' });

        // Divider
        tableY += 15;
        doc.strokeColor(COLORS.border)
           .lineWidth(1)
           .moveTo(totalsX, tableY)
           .lineTo(totalsX + 200, tableY)
           .stroke();

        // Total
        tableY += 10;
        doc.fontSize(14)
           .fillColor(COLORS.text)
           .text('TOTAL:', totalsX, tableY, { width: 100 })
           .fillColor(COLORS.primary)
           .text(`$${data.total.toFixed(2)}`, totalsX + 100, tableY, { width: 100, align: 'right' });

        // Notes & Payment Terms
        doc.y = tableY + 50;

        if (data.notes) {
          doc.fontSize(10)
             .fillColor(COLORS.textLight)
             .text('NOTES', marginLeft, doc.y);
          doc.fontSize(9)
             .fillColor(COLORS.text)
             .text(data.notes, marginLeft, doc.y += 15, { width: contentWidth });
          doc.y += 20;
        }

        if (data.paymentTerms) {
          doc.fontSize(10)
             .fillColor(COLORS.textLight)
             .text('PAYMENT TERMS', marginLeft, doc.y);
          doc.fontSize(9)
             .fillColor(COLORS.text)
             .text(data.paymentTerms, marginLeft, doc.y += 15, { width: contentWidth });
        }

        // Footer
        this.drawFooter(doc, 1);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}

// ============================================
// Export Service Instance
// ============================================

export const pdfService = new PDFService();
export default pdfService;
