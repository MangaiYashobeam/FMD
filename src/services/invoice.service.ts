/**
 * Invoice Service
 * 
 * Generates and manages invoices for subscription billing
 * Uses the PDF service for professional invoice generation
 * Works with Stripe-based Invoice model from the schema
 */

import prisma from '@/config/database';
import { logger } from '@/utils/logger';
import { pdfService, InvoiceData } from './pdf.service';
import { emailService } from './email.service';
import { BRANDING } from './email-templates.service';
import { getPlanBySlug } from '@/config/subscriptionPlans';

// ============================================
// Types
// ============================================

export interface InvoiceResult {
  invoice: any;
  pdf?: Buffer;
}

// ============================================
// Invoice Number Generation
// ============================================

async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  // Get count of invoices this month
  const startOfMonth = new Date(year, now.getMonth(), 1);
  const endOfMonth = new Date(year, now.getMonth() + 1, 0);
  
  const count = await prisma.invoice.count({
    where: {
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  });
  
  const sequence = String(count + 1).padStart(4, '0');
  return `INV-${year}${month}-${sequence}`;
}

// ============================================
// Get Admin Email for Account
// ============================================

async function getAccountAdminEmail(accountId: string): Promise<{ email: string; name: string } | null> {
  const accountUser = await prisma.accountUser.findFirst({
    where: { 
      accountId,
      role: { in: ['ADMIN', 'ACCOUNT_OWNER'] }
    },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  });

  if (accountUser?.user) {
    return {
      email: accountUser.user.email,
      name: [accountUser.user.firstName, accountUser.user.lastName].filter(Boolean).join(' ') || accountUser.user.email,
    };
  }
  return null;
}

// ============================================
// Send Invoice Email
// ============================================

export async function sendInvoiceEmail(invoiceId: string): Promise<void> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        account: true,
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const admin = await getAccountAdminEmail(invoice.accountId);
    if (!admin) {
      throw new Error('No admin found for account');
    }

    // Prepare PDF data from Stripe-based invoice
    const pdfData: InvoiceData = {
      invoiceNumber: invoice.invoiceNumber || invoice.stripeInvoiceId,
      invoiceDate: invoice.createdAt,
      dueDate: invoice.dueDate || new Date(),
      company: {
        name: BRANDING.companyName,
        address: '123 Tech Plaza, Suite 500',
        city: 'Austin',
        state: 'TX',
        zip: '78701',
        email: BRANDING.supportEmail,
        phone: '(555) 123-4567',
      },
      customer: {
        name: invoice.account.name,
        email: admin.email,
        address: invoice.account.address || undefined,
        city: invoice.account.city || undefined,
        state: invoice.account.state || undefined,
        zip: invoice.account.zip || undefined,
      },
      items: buildInvoiceItems(invoice),
      subtotal: Number(invoice.amountDue),
      tax: 0,
      taxRate: 0,
      total: Number(invoice.amountDue),
      notes: undefined,
      paymentTerms: 'Due upon receipt',
      status: invoice.status.toLowerCase() as 'paid' | 'pending' | 'overdue',
    };

    // Generate PDF
    const pdfBuffer = await pdfService.generateInvoice(pdfData);

    // Send email
    await emailService.sendEmail({
      to: admin.email,
      subject: `Invoice ${invoice.invoiceNumber || invoice.stripeInvoiceId} from ${BRANDING.companyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Invoice ${invoice.invoiceNumber || invoice.stripeInvoiceId}</h2>
          <p>Dear ${admin.name},</p>
          <p>Please find attached your invoice from ${BRANDING.companyName}.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f8f9fa;">
              <td style="padding: 12px; border: 1px solid #e2e8f0;"><strong>Invoice Number</strong></td>
              <td style="padding: 12px; border: 1px solid #e2e8f0;">${invoice.invoiceNumber || invoice.stripeInvoiceId}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #e2e8f0;"><strong>Billing Period</strong></td>
              <td style="padding: 12px; border: 1px solid #e2e8f0;">${invoice.periodStart.toLocaleDateString()} - ${invoice.periodEnd.toLocaleDateString()}</td>
            </tr>
            <tr style="background: #f8f9fa;">
              <td style="padding: 12px; border: 1px solid #e2e8f0;"><strong>Amount Due</strong></td>
              <td style="padding: 12px; border: 1px solid #e2e8f0; font-size: 18px; color: #2563eb;"><strong>$${Number(invoice.amountDue).toFixed(2)}</strong></td>
            </tr>
            ${invoice.hostedUrl ? `
            <tr>
              <td colspan="2" style="padding: 12px; text-align: center;">
                <a href="${invoice.hostedUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
                  Pay Invoice Online
                </a>
              </td>
            </tr>
            ` : ''}
          </table>
          <p>If you have any questions about this invoice, please contact us at ${BRANDING.supportEmail}.</p>
          <p>Thank you for your business!</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 12px;">
            ${BRANDING.companyName} | ${BRANDING.websiteUrl}
          </p>
        </div>
      `,
      attachments: [{
        filename: `${invoice.invoiceNumber || invoice.stripeInvoiceId}.pdf`,
        content: pdfBuffer,
      }],
    });

    logger.info(`Invoice email sent: ${invoice.invoiceNumber} to ${admin.email}`);
  } catch (error) {
    logger.error('Failed to send invoice email:', error);
    throw error;
  }
}

// ============================================
// Build Invoice Items from Stripe Invoice
// ============================================

function buildInvoiceItems(invoice: any): InvoiceData['items'] {
  const items: InvoiceData['items'] = [];
  
  // Get plan details if available
  const account = invoice.account;
  const planName = account?.subscriptionPlan?.name || 'Subscription';
  const planSlug = account?.subscriptionPlan?.slug;
  const planConfig = planSlug ? getPlanBySlug(planSlug) : null;
  
  // Determine if lifetime plan
  const isLifetime = planConfig?.billingInterval === 'lifetime' || account?.subscriptionPlan?.billingInterval === 'lifetime';
  
  // Base subscription charge
  if (invoice.baseCharge && Number(invoice.baseCharge) > 0) {
    items.push({
      description: isLifetime 
        ? `${planName} - ${planConfig?.lifetimeDuration || 4} Year Lifetime Access`
        : `${planName} Plan - Monthly Subscription`,
      quantity: 1,
      unitPrice: Number(invoice.baseCharge),
      total: Number(invoice.baseCharge),
    });
  }
  
  // Extra user charges (not applicable for Pro/Enterprise - unlimited users)
  if (invoice.extraUserCount > 0 && Number(invoice.extraUserCharge) > 0) {
    const extraUserRate = planConfig?.extraUserPrice || (Number(invoice.extraUserCharge) / invoice.extraUserCount);
    items.push({
      description: `Additional Users (${invoice.extraUserCount} users × $${extraUserRate}/user)`,
      quantity: invoice.extraUserCount,
      unitPrice: extraUserRate,
      total: Number(invoice.extraUserCharge),
    });
  }
  
  // If no items, show total as single line
  if (items.length === 0) {
    items.push({
      description: `${planName} - Subscription Services`,
      quantity: 1,
      unitPrice: Number(invoice.amountDue),
      total: Number(invoice.amountDue),
    });
  }
  
  return items;
}

// ============================================
// Get Invoice PDF
// ============================================

export async function getInvoicePDF(invoiceId: string): Promise<Buffer> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      account: true,
    },
  });

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  const admin = await getAccountAdminEmail(invoice.accountId);

  const pdfData: InvoiceData = {
    invoiceNumber: invoice.invoiceNumber || invoice.stripeInvoiceId,
    invoiceDate: invoice.createdAt,
    dueDate: invoice.dueDate || new Date(),
    company: {
      name: BRANDING.companyName,
      address: '123 Tech Plaza, Suite 500',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      email: BRANDING.supportEmail,
      phone: '(555) 123-4567',
    },
    customer: {
      name: invoice.account.name,
      email: admin?.email || 'N/A',
      address: invoice.account.address || undefined,
      city: invoice.account.city || undefined,
      state: invoice.account.state || undefined,
      zip: invoice.account.zip || undefined,
    },
    items: buildInvoiceItems(invoice),
    subtotal: Number(invoice.amountDue),
    tax: 0,
    taxRate: 0,
    total: Number(invoice.amountDue),
    notes: undefined,
    paymentTerms: 'Due upon receipt',
    status: invoice.status.toLowerCase() as 'paid' | 'pending' | 'overdue',
  };

  return pdfService.generateInvoice(pdfData);
}

// ============================================
// Mark Invoice as Paid
// ============================================

export async function markInvoicePaid(invoiceId: string): Promise<any> {
  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: 'paid',
      paidAt: new Date(),
      amountPaid: (await prisma.invoice.findUnique({ where: { id: invoiceId } }))?.amountDue || 0,
    },
  });

  logger.info(`Invoice marked as paid: ${invoice.invoiceNumber}`);
  return invoice;
}

// ============================================
// Get Account Invoices
// ============================================

export async function getAccountInvoices(accountId: string, options?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  return prisma.invoice.findMany({
    where: {
      accountId,
      ...(options?.status && { status: options.status }),
    },
    include: {
      account: true,
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0,
  });
}

// ============================================
// Get Invoice By ID
// ============================================

export async function getInvoiceById(invoiceId: string): Promise<any> {
  return prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      account: true,
      payments: true,
    },
  });
}

// ============================================
// Export Service
// ============================================

export const invoiceService = {
  sendInvoiceEmail,
  getInvoicePDF,
  markInvoicePaid,
  getAccountInvoices,
  getInvoiceById,
  generateInvoiceNumber,
};

export default invoiceService;
