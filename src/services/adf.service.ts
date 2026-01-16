/**
 * ADF (Auto-Lead Data Format) Service
 * Industry standard XML format for automotive lead data exchange
 * Compliant with ADF XML Schema 1.0
 */

import { logger } from '@/utils/logger';
import prisma from '@/config/database';
import { Lead, Vehicle, Account } from '@prisma/client';
import nodemailer from 'nodemailer';

// Type for Lead with Vehicle included
type LeadWithVehicle = Lead & { vehicle?: Vehicle | null };
type LeadWithVehicleAndAccount = Lead & { vehicle?: Vehicle | null; account?: Account | null };

// ADF XML Schema version
const ADF_VERSION = '1.0';

export interface ADFCustomer {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  altPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  comments?: string;
}

export interface ADFVehicle {
  status?: 'new' | 'used';
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  vin?: string;
  stockNumber?: string;
  price?: number;
  mileage?: number;
  exteriorColor?: string;
  interiorColor?: string;
  transmission?: string;
  fuelType?: string;
  bodyStyle?: string;
}

export interface ADFTradeIn {
  year?: number;
  make?: string;
  model?: string;
  vin?: string;
  mileage?: number;
  payoff?: number;
}

export interface ADFProvider {
  name: string;
  email?: string;
  phone?: string;
  url?: string;
}

export interface ADFVendor {
  name: string;
  email?: string;
  phone?: string;
  id?: string;
}

export interface ADFLeadData {
  id: string;
  source?: string;
  requestDate: Date;
  customer: ADFCustomer;
  vehicle?: ADFVehicle;
  tradeIn?: ADFTradeIn;
  provider?: ADFProvider;
  vendor?: ADFVendor;
}

export class ADFService {
  /**
   * Generate ADF XML from lead data
   */
  generateADFXML(data: ADFLeadData): string {
    const xml: string[] = [];
    
    xml.push('<?xml version="1.0" encoding="UTF-8"?>');
    xml.push('<?adf version="1.0"?>');
    xml.push('<adf>');
    xml.push('  <prospect status="new">');
    xml.push(`    <id sequence="1" source="${this.escapeXml(data.source || 'Dealers Face')}">${this.escapeXml(data.id)}</id>`);
    xml.push(`    <requestdate>${this.formatDate(data.requestDate)}</requestdate>`);
    
    // Vehicle Interest Section
    if (data.vehicle) {
      xml.push('    <vehicle interest="buy" status="' + (data.vehicle.status || 'used') + '">');
      if (data.vehicle.year) xml.push(`      <year>${data.vehicle.year}</year>`);
      if (data.vehicle.make) xml.push(`      <make>${this.escapeXml(data.vehicle.make)}</make>`);
      if (data.vehicle.model) xml.push(`      <model>${this.escapeXml(data.vehicle.model)}</model>`);
      if (data.vehicle.trim) xml.push(`      <trim>${this.escapeXml(data.vehicle.trim)}</trim>`);
      if (data.vehicle.vin) xml.push(`      <vin>${this.escapeXml(data.vehicle.vin)}</vin>`);
      if (data.vehicle.stockNumber) xml.push(`      <stock>${this.escapeXml(data.vehicle.stockNumber)}</stock>`);
      if (data.vehicle.price) xml.push(`      <price type="asking" currency="USD">${data.vehicle.price}</price>`);
      if (data.vehicle.mileage) xml.push(`      <odometer status="replaced" units="mi">${data.vehicle.mileage}</odometer>`);
      if (data.vehicle.exteriorColor) xml.push(`      <colorcombination><exteriorcolor>${this.escapeXml(data.vehicle.exteriorColor)}</exteriorcolor></colorcombination>`);
      if (data.vehicle.interiorColor) xml.push(`      <colorcombination><interiorcolor>${this.escapeXml(data.vehicle.interiorColor)}</interiorcolor></colorcombination>`);
      if (data.vehicle.transmission) xml.push(`      <transmission>${this.escapeXml(data.vehicle.transmission)}</transmission>`);
      if (data.vehicle.fuelType) xml.push(`      <fueltypeengine>${this.escapeXml(data.vehicle.fuelType)}</fueltypeengine>`);
      if (data.vehicle.bodyStyle) xml.push(`      <bodystyle>${this.escapeXml(data.vehicle.bodyStyle)}</bodystyle>`);
      xml.push('    </vehicle>');
    }
    
    // Trade-In Vehicle Section
    if (data.tradeIn && (data.tradeIn.year || data.tradeIn.make || data.tradeIn.model)) {
      xml.push('    <vehicle interest="trade-in" status="used">');
      if (data.tradeIn.year) xml.push(`      <year>${data.tradeIn.year}</year>`);
      if (data.tradeIn.make) xml.push(`      <make>${this.escapeXml(data.tradeIn.make)}</make>`);
      if (data.tradeIn.model) xml.push(`      <model>${this.escapeXml(data.tradeIn.model)}</model>`);
      if (data.tradeIn.vin) xml.push(`      <vin>${this.escapeXml(data.tradeIn.vin)}</vin>`);
      if (data.tradeIn.mileage) xml.push(`      <odometer status="replaced" units="mi">${data.tradeIn.mileage}</odometer>`);
      if (data.tradeIn.payoff) xml.push(`      <finance><balance type="payoff">${data.tradeIn.payoff}</balance></finance>`);
      xml.push('    </vehicle>');
    }
    
    // Customer Section
    xml.push('    <customer>');
    xml.push('      <contact>');
    
    // Name handling
    if (data.customer.fullName) {
      xml.push(`        <name part="full">${this.escapeXml(data.customer.fullName)}</name>`);
    } else {
      if (data.customer.firstName) xml.push(`        <name part="first">${this.escapeXml(data.customer.firstName)}</name>`);
      if (data.customer.lastName) xml.push(`        <name part="last">${this.escapeXml(data.customer.lastName)}</name>`);
    }
    
    // Contact info
    if (data.customer.email) xml.push(`        <email>${this.escapeXml(data.customer.email)}</email>`);
    if (data.customer.phone) xml.push(`        <phone type="voice" time="day">${this.escapeXml(data.customer.phone)}</phone>`);
    if (data.customer.altPhone) xml.push(`        <phone type="voice" time="evening">${this.escapeXml(data.customer.altPhone)}</phone>`);
    
    // Address
    if (data.customer.address || data.customer.city || data.customer.state || data.customer.zip) {
      xml.push('        <address type="home">');
      if (data.customer.address) xml.push(`          <street line="1">${this.escapeXml(data.customer.address)}</street>`);
      if (data.customer.city) xml.push(`          <city>${this.escapeXml(data.customer.city)}</city>`);
      if (data.customer.state) xml.push(`          <regioncode>${this.escapeXml(data.customer.state)}</regioncode>`);
      if (data.customer.zip) xml.push(`          <postalcode>${this.escapeXml(data.customer.zip)}</postalcode>`);
      xml.push(`          <country>${this.escapeXml(data.customer.country || 'US')}</country>`);
      xml.push('        </address>');
    }
    
    xml.push('      </contact>');
    
    // Customer comments
    if (data.customer.comments) {
      xml.push(`      <comments>${this.escapeXml(data.customer.comments)}</comments>`);
    }
    
    xml.push('    </customer>');
    
    // Vendor Section (Dealership)
    if (data.vendor) {
      xml.push('    <vendor>');
      xml.push(`      <vendorname>${this.escapeXml(data.vendor.name)}</vendorname>`);
      if (data.vendor.id) xml.push(`      <id>${this.escapeXml(data.vendor.id)}</id>`);
      xml.push('      <contact>');
      if (data.vendor.email) xml.push(`        <email>${this.escapeXml(data.vendor.email)}</email>`);
      if (data.vendor.phone) xml.push(`        <phone type="voice">${this.escapeXml(data.vendor.phone)}</phone>`);
      xml.push('      </contact>');
      xml.push('    </vendor>');
    }
    
    // Provider Section (Lead Source)
    if (data.provider) {
      xml.push('    <provider>');
      xml.push(`      <name part="full">${this.escapeXml(data.provider.name)}</name>`);
      xml.push('      <service>Facebook Marketplace Lead</service>');
      if (data.provider.email) xml.push(`      <email>${this.escapeXml(data.provider.email)}</email>`);
      if (data.provider.phone) xml.push(`      <phone>${this.escapeXml(data.provider.phone)}</phone>`);
      if (data.provider.url) xml.push(`      <url>${this.escapeXml(data.provider.url)}</url>`);
      xml.push('    </provider>');
    }
    
    xml.push('  </prospect>');
    xml.push('</adf>');
    
    return xml.join('\n');
  }

  /**
   * Generate ADF XML from a Lead entity
   */
  async generateADFFromLead(lead: Lead, vehicle?: Vehicle | null): Promise<string> {
    // Get account info for vendor section
    const account = await prisma.account.findUnique({
      where: { id: lead.accountId },
      select: {
        name: true,
        dealershipName: true,
        phone: true,
        website: true,
      },
    });

    const adfData: ADFLeadData = {
      id: lead.leadNumber,
      source: this.mapLeadSourceToADF(lead.source),
      requestDate: lead.createdAt,
      customer: {
        firstName: lead.firstName || undefined,
        lastName: lead.lastName || undefined,
        fullName: lead.fullName || undefined,
        email: lead.email || undefined,
        phone: lead.phone || undefined,
        altPhone: lead.altPhone || undefined,
        address: lead.address || undefined,
        city: lead.city || undefined,
        state: lead.state || undefined,
        zip: lead.zip || undefined,
        country: lead.country || 'US',
        comments: lead.customerComments || undefined,
      },
      vehicle: vehicle ? {
        status: vehicle.isNew ? 'new' : 'used',
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim || undefined,
        vin: vehicle.vin,
        stockNumber: vehicle.stockNumber || undefined,
        price: vehicle.listPrice ? Number(vehicle.listPrice) : undefined,
        mileage: vehicle.mileage || undefined,
        exteriorColor: vehicle.exteriorColor || undefined,
        interiorColor: vehicle.interiorColor || undefined,
        transmission: vehicle.transmission || undefined,
        fuelType: vehicle.fuelType || undefined,
        bodyStyle: vehicle.bodyStyle || undefined,
      } : (lead.interestedYear ? {
        status: 'used',
        year: lead.interestedYear,
        make: lead.interestedMake || undefined,
        model: lead.interestedModel || undefined,
        vin: lead.interestedVin || undefined,
        stockNumber: lead.interestedStockNumber || undefined,
      } : undefined),
      tradeIn: lead.hasTradeIn ? {
        year: lead.tradeYear || undefined,
        make: lead.tradeMake || undefined,
        model: lead.tradeModel || undefined,
        vin: lead.tradeVin || undefined,
        mileage: lead.tradeMileage || undefined,
        payoff: lead.tradePayoff ? Number(lead.tradePayoff) : undefined,
      } : undefined,
      vendor: account ? {
        name: account.dealershipName || account.name,
        phone: account.phone || undefined,
      } : undefined,
      provider: {
        name: 'Dealers Face',
        url: 'https://dealersface.com',
      },
    };

    return this.generateADFXML(adfData);
  }

  /**
   * Send ADF via email
   */
  async sendADFEmail(
    leadId: string,
    recipients: string[],
    options?: {
      senderEmail?: string;
      subjectPrefix?: string;
      includeHtmlSummary?: boolean;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const lead: LeadWithVehicleAndAccount | null = await prisma.lead.findUnique({
        where: { id: leadId },
        include: {
          vehicle: true,
          account: true,
        },
      });

      if (!lead) {
        return { success: false, error: 'Lead not found' };
      }

      // Get email settings
      const emailSettings = await prisma.systemSettings.findUnique({
        where: { key: 'email' },
      });

      const settings = emailSettings?.value as any || {};
      
      // Generate ADF XML
      const adfXml = await this.generateADFFromLead(lead, lead.vehicle || undefined);

      // Build email subject
      const customerName = lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown';
      const vehicleInfo = lead.vehicle 
        ? `${lead.vehicle.year} ${lead.vehicle.make} ${lead.vehicle.model}`
        : (lead.interestedVehicle || 'Vehicle Inquiry');
      const subject = `${options?.subjectPrefix || '[New Lead]'} ${customerName} - ${vehicleInfo}`;

      // Create transporter
      const transporter = nodemailer.createTransport({
        host: settings.smtpHost || process.env.SMTP_HOST,
        port: settings.smtpPort || parseInt(process.env.SMTP_PORT || '587'),
        secure: settings.smtpSecure || process.env.SMTP_SECURE === 'true',
        auth: {
          user: settings.smtpUser || process.env.SMTP_USER,
          pass: settings.smtpPassword || process.env.SMTP_PASSWORD,
        },
      });

      // Build HTML summary if requested
      let htmlContent = '';
      if (options?.includeHtmlSummary !== false) {
        htmlContent = this.generateLeadHtmlSummary(lead, lead.vehicle);
      }

      // Send email with ADF attachment
      const result = await transporter.sendMail({
        from: options?.senderEmail || settings.fromEmail || process.env.SMTP_FROM,
        to: recipients.join(', '),
        subject,
        text: `New lead received. ADF XML attached.\n\nCustomer: ${customerName}\nEmail: ${lead.email || 'N/A'}\nPhone: ${lead.phone || 'N/A'}\nVehicle Interest: ${vehicleInfo}`,
        html: htmlContent || undefined,
        attachments: [
          {
            filename: `lead_${lead.leadNumber}.xml`,
            content: adfXml,
            contentType: 'application/xml',
          },
        ],
      });

      // Record submission
      await prisma.aDFSubmission.create({
        data: {
          leadId,
          accountId: lead.accountId,
          method: 'EMAIL',
          adfXml,
          adfVersion: ADF_VERSION,
          status: 'SENT',
          emailTo: recipients,
          emailMessageId: result.messageId,
          sentAt: new Date(),
        },
      });

      // Update lead
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          adfSent: true,
          adfSentAt: new Date(),
          adfMessageId: result.messageId,
          adfDeliveryStatus: 'SENT',
        },
      });

      logger.info(`ADF email sent for lead ${lead.leadNumber} to ${recipients.join(', ')}`);
      return { success: true, messageId: result.messageId };
    } catch (error: any) {
      logger.error('Failed to send ADF email:', error);
      
      // Record failed submission
      await prisma.aDFSubmission.create({
        data: {
          leadId,
          accountId: (await prisma.lead.findUnique({ where: { id: leadId } }))?.accountId || '',
          method: 'EMAIL',
          adfXml: '',
          status: 'FAILED',
          statusMessage: error.message,
          emailTo: recipients,
          failedAt: new Date(),
        },
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Send ADF via HTTP POST to DMS
   */
  async sendADFToDMS(
    leadId: string,
    endpoint: string,
    options?: {
      username?: string;
      password?: string;
      apiKey?: string;
    }
  ): Promise<{ success: boolean; dmsLeadId?: string; error?: string }> {
    try {
      const lead: LeadWithVehicle | null = await prisma.lead.findUnique({
        where: { id: leadId },
        include: { vehicle: true },
      });

      if (!lead) {
        return { success: false, error: 'Lead not found' };
      }

      const adfXml = await this.generateADFFromLead(lead, lead.vehicle || undefined);

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml, text/xml, */*',
      };

      if (options?.apiKey) {
        headers['Authorization'] = `Bearer ${options.apiKey}`;
      } else if (options?.username && options?.password) {
        const auth = Buffer.from(`${options.username}:${options.password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      }

      // Send to DMS
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: adfXml,
      });

      const responseText = await response.text();

      // Record submission
      const submission = await prisma.aDFSubmission.create({
        data: {
          leadId,
          accountId: lead.accountId,
          method: 'HTTP_POST',
          endpoint,
          adfXml,
          adfVersion: ADF_VERSION,
          status: response.ok ? 'DELIVERED' : 'FAILED',
          responseCode: response.status,
          responseBody: responseText,
          sentAt: new Date(),
          deliveredAt: response.ok ? new Date() : undefined,
          failedAt: response.ok ? undefined : new Date(),
        },
      });

      if (response.ok) {
        // Try to extract DMS lead ID from response
        const dmsLeadIdMatch = responseText.match(/<id[^>]*>([^<]+)<\/id>|"leadId":\s*"([^"]+)"/);
        const dmsLeadId = dmsLeadIdMatch?.[1] || dmsLeadIdMatch?.[2];

        await prisma.aDFSubmission.update({
          where: { id: submission.id },
          data: { dmsLeadId },
        });

        await prisma.lead.update({
          where: { id: leadId },
          data: {
            adfSent: true,
            adfSentAt: new Date(),
            adfDeliveryStatus: 'DELIVERED',
          },
        });

        logger.info(`ADF sent to DMS for lead ${lead.leadNumber}`);
        return { success: true, dmsLeadId };
      }

      return { success: false, error: `DMS returned status ${response.status}: ${responseText}` };
    } catch (error: any) {
      logger.error('Failed to send ADF to DMS:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate next lead number
   */
  async generateLeadNumber(accountId: string): Promise<string> {
    const today = new Date();
    const prefix = `FMD${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    // Get count of leads for this month
    const count = await prisma.lead.count({
      where: {
        accountId,
        createdAt: {
          gte: new Date(today.getFullYear(), today.getMonth(), 1),
        },
      },
    });

    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  /**
   * Parse ADF XML into lead data
   */
  parseADFXML(xml: string): Partial<ADFLeadData> | null {
    try {
      // Basic XML parsing - in production, use a proper XML parser
      const data: Partial<ADFLeadData> = {
        customer: {},
      };

      // Extract customer name
      const firstNameMatch = xml.match(/<name part="first">([^<]+)<\/name>/i);
      const lastNameMatch = xml.match(/<name part="last">([^<]+)<\/name>/i);
      const fullNameMatch = xml.match(/<name part="full">([^<]+)<\/name>/i);
      
      if (data.customer) {
        data.customer.firstName = firstNameMatch?.[1];
        data.customer.lastName = lastNameMatch?.[1];
        data.customer.fullName = fullNameMatch?.[1];
      }

      // Extract contact info
      const emailMatch = xml.match(/<email>([^<]+)<\/email>/i);
      const phoneMatch = xml.match(/<phone[^>]*>([^<]+)<\/phone>/i);
      
      if (data.customer) {
        data.customer.email = emailMatch?.[1];
        data.customer.phone = phoneMatch?.[1];
      }

      // Extract vehicle info
      const yearMatch = xml.match(/<year>(\d+)<\/year>/i);
      const makeMatch = xml.match(/<make>([^<]+)<\/make>/i);
      const modelMatch = xml.match(/<model>([^<]+)<\/model>/i);
      const vinMatch = xml.match(/<vin>([^<]+)<\/vin>/i);

      if (yearMatch || makeMatch || modelMatch) {
        data.vehicle = {
          year: yearMatch ? parseInt(yearMatch[1]) : undefined,
          make: makeMatch?.[1],
          model: modelMatch?.[1],
          vin: vinMatch?.[1],
        };
      }

      return data;
    } catch (error) {
      logger.error('Failed to parse ADF XML:', error);
      return null;
    }
  }

  /**
   * Generate HTML summary for lead email
   */
  private generateLeadHtmlSummary(lead: Lead, vehicle?: Vehicle | null): string {
    const customerName = lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown Customer';
    const vehicleInfo = vehicle 
      ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''}`
      : (lead.interestedVehicle || 'Vehicle Inquiry');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a56db; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .section { margin-bottom: 20px; }
    .section-title { font-weight: bold; color: #1a56db; border-bottom: 2px solid #1a56db; padding-bottom: 5px; margin-bottom: 10px; }
    .label { font-weight: bold; color: #666; }
    .value { color: #333; }
    .footer { background: #f3f4f6; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #666; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 8px 0; vertical-align: top; }
    .priority-high { color: #dc2626; font-weight: bold; }
    .priority-medium { color: #d97706; }
    .priority-low { color: #059669; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">🚗 New Lead Received</h1>
      <p style="margin: 10px 0 0 0;">Lead #${lead.leadNumber}</p>
    </div>
    <div class="content">
      <div class="section">
        <div class="section-title">👤 Customer Information</div>
        <table>
          <tr><td class="label" width="120">Name:</td><td class="value">${customerName}</td></tr>
          <tr><td class="label">Email:</td><td class="value">${lead.email || 'Not provided'}</td></tr>
          <tr><td class="label">Phone:</td><td class="value">${lead.phone || 'Not provided'}</td></tr>
          ${lead.address ? `<tr><td class="label">Address:</td><td class="value">${lead.address}, ${lead.city || ''} ${lead.state || ''} ${lead.zip || ''}</td></tr>` : ''}
        </table>
      </div>
      
      <div class="section">
        <div class="section-title">🚙 Vehicle Interest</div>
        <table>
          <tr><td class="label" width="120">Vehicle:</td><td class="value">${vehicleInfo}</td></tr>
          ${vehicle?.vin ? `<tr><td class="label">VIN:</td><td class="value">${vehicle.vin}</td></tr>` : ''}
          ${vehicle?.stockNumber ? `<tr><td class="label">Stock #:</td><td class="value">${vehicle.stockNumber}</td></tr>` : ''}
          ${vehicle?.listPrice ? `<tr><td class="label">Price:</td><td class="value">$${Number(vehicle.listPrice).toLocaleString()}</td></tr>` : ''}
          ${vehicle?.mileage ? `<tr><td class="label">Mileage:</td><td class="value">${vehicle.mileage.toLocaleString()} miles</td></tr>` : ''}
        </table>
      </div>
      
      ${lead.hasTradeIn ? `
      <div class="section">
        <div class="section-title">🔄 Trade-In Vehicle</div>
        <table>
          <tr><td class="label" width="120">Vehicle:</td><td class="value">${lead.tradeYear || ''} ${lead.tradeMake || ''} ${lead.tradeModel || ''}</td></tr>
          ${lead.tradeMileage ? `<tr><td class="label">Mileage:</td><td class="value">${lead.tradeMileage.toLocaleString()} miles</td></tr>` : ''}
          ${lead.tradePayoff ? `<tr><td class="label">Payoff:</td><td class="value">$${Number(lead.tradePayoff).toLocaleString()}</td></tr>` : ''}
        </table>
      </div>
      ` : ''}
      
      ${lead.customerComments ? `
      <div class="section">
        <div class="section-title">💬 Customer Comments</div>
        <p style="background: white; padding: 15px; border-radius: 4px; margin: 0;">${lead.customerComments}</p>
      </div>
      ` : ''}
      
      <div class="section">
        <div class="section-title">📊 Lead Details</div>
        <table>
          <tr><td class="label" width="120">Source:</td><td class="value">${lead.source}</td></tr>
          <tr><td class="label">Priority:</td><td class="value ${lead.priority === 'HIGH' || lead.priority === 'URGENT' ? 'priority-high' : lead.priority === 'MEDIUM' ? 'priority-medium' : 'priority-low'}">${lead.priority}</td></tr>
          <tr><td class="label">Status:</td><td class="value">${lead.status}</td></tr>
          <tr><td class="label">Received:</td><td class="value">${lead.createdAt.toLocaleString()}</td></tr>
        </table>
      </div>
    </div>
    <div class="footer">
      <p>This lead was generated by Dealers Face | ADF XML attached for DMS import</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Map lead source to ADF source string
   */
  private mapLeadSourceToADF(source: string): string {
    const sourceMap: Record<string, string> = {
      FACEBOOK_MARKETPLACE: 'Facebook Marketplace',
      FACEBOOK_PAGE: 'Facebook',
      WEBSITE: 'Website',
      WALK_IN: 'Walk-In',
      PHONE: 'Phone',
      EMAIL: 'Email',
      REFERRAL: 'Referral',
      THIRD_PARTY: 'Third Party',
      ADF_IMPORT: 'ADF Import',
      MANUAL: 'Manual Entry',
    };
    return sourceMap[source] || 'Dealers Face';
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Format date for ADF XML
   */
  private formatDate(date: Date): string {
    return date.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
  }
}

export const adfService = new ADFService();
