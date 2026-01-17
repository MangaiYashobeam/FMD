/**
 * Facebook Hybrid Service
 * 
 * Combines:
 * 1. Facebook SDK/Pixel for legitimate tracking
 * 2. OAuth for user authorization
 * 3. Chrome Extension for browser automation
 * 4. AI Agent for intelligent navigation
 */

import { logger } from '@/utils/logger';
import prisma from '@/config/database';
import FACEBOOK_CONFIG from '@/config/facebook';
import axios from 'axios';
import crypto from 'crypto';

// ============================================
// Types
// ============================================

interface FacebookUser {
  id: string;
  name: string;
  email: string;
  picture?: { data: { url: string } };
}

interface FacebookToken {
  accessToken: string;
  expiresAt: Date;
  userId: string;
}

interface MarketplaceTask {
  id: string;
  type: 'post' | 'edit' | 'delete' | 'renew' | 'message' | 'scrape';
  accountId: string;
  data: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retries: number;
  createdAt: Date;
}

// ============================================
// OAuth Service
// ============================================

export class FacebookOAuthService {
  /**
   * Generate OAuth authorization URL
   */
  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: FACEBOOK_CONFIG.appId,
      redirect_uri: FACEBOOK_CONFIG.oauth.redirectUri,
      scope: FACEBOOK_CONFIG.oauth.scope.join(','),
      response_type: 'code',
      state,
    });
    
    return `${FACEBOOK_CONFIG.api.authUrl}?${params.toString()}`;
  }
  
  /**
   * Exchange authorization code for access token
   */
  async getAccessToken(code: string): Promise<FacebookToken> {
    try {
      const response = await axios.get(FACEBOOK_CONFIG.api.tokenUrl, {
        params: {
          client_id: FACEBOOK_CONFIG.appId,
          client_secret: FACEBOOK_CONFIG.appSecret,
          redirect_uri: FACEBOOK_CONFIG.oauth.redirectUri,
          code,
        },
      });
      
      const { access_token, expires_in } = response.data;
      
      // Get user ID
      const userResponse = await axios.get(`${FACEBOOK_CONFIG.api.baseUrl}/me`, {
        params: { access_token, fields: 'id' },
      });
      
      return {
        accessToken: access_token,
        expiresAt: new Date(Date.now() + expires_in * 1000),
        userId: userResponse.data.id,
      };
    } catch (error) {
      logger.error('Failed to get Facebook access token:', error);
      throw error;
    }
  }
  
  /**
   * Get long-lived token (60 days)
   */
  async getLongLivedToken(shortLivedToken: string): Promise<FacebookToken> {
    try {
      const response = await axios.get(`${FACEBOOK_CONFIG.api.baseUrl}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: FACEBOOK_CONFIG.appId,
          client_secret: FACEBOOK_CONFIG.appSecret,
          fb_exchange_token: shortLivedToken,
        },
      });
      
      const { access_token, expires_in } = response.data;
      
      const userResponse = await axios.get(`${FACEBOOK_CONFIG.api.baseUrl}/me`, {
        params: { access_token, fields: 'id' },
      });
      
      return {
        accessToken: access_token,
        expiresAt: new Date(Date.now() + expires_in * 1000),
        userId: userResponse.data.id,
      };
    } catch (error) {
      logger.error('Failed to get long-lived token:', error);
      throw error;
    }
  }
  
  /**
   * Get user profile from Facebook
   */
  async getUserProfile(accessToken: string): Promise<FacebookUser> {
    try {
      const response = await axios.get(`${FACEBOOK_CONFIG.api.baseUrl}/me`, {
        params: {
          access_token: accessToken,
          fields: 'id,name,email,picture',
        },
      });
      
      return response.data;
    } catch (error) {
      logger.error('Failed to get Facebook user profile:', error);
      throw error;
    }
  }
  
  /**
   * Verify token is valid
   */
  async verifyToken(accessToken: string): Promise<boolean> {
    try {
      const response = await axios.get(`${FACEBOOK_CONFIG.api.baseUrl}/debug_token`, {
        params: {
          input_token: accessToken,
          access_token: `${FACEBOOK_CONFIG.appId}|${FACEBOOK_CONFIG.appSecret}`,
        },
      });
      
      return response.data.data.is_valid;
    } catch (error) {
      return false;
    }
  }
}

// ============================================
// Task Queue for Extension Commands
// ============================================

export class ExtensionTaskQueue {
  private tasks: Map<string, MarketplaceTask> = new Map();
  private listeners: Map<string, (task: MarketplaceTask) => void> = new Map();
  
  /**
   * Add task to queue
   */
  async addTask(task: Omit<MarketplaceTask, 'id' | 'status' | 'retries' | 'createdAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const fullTask: MarketplaceTask = {
      ...task,
      id,
      status: 'pending',
      retries: 0,
      createdAt: new Date(),
    };
    
    this.tasks.set(id, fullTask);
    
    // Store in database for persistence
    await prisma.extensionTask.create({
      data: {
        id,
        type: task.type,
        accountId: task.accountId,
        data: task.data,
        status: 'pending',
      },
    });
    
    // Notify waiting extension
    const listener = this.listeners.get(task.accountId);
    if (listener) {
      listener(fullTask);
    }
    
    logger.info(`Task ${id} added to queue: ${task.type}`);
    return id;
  }
  
  /**
   * Get pending tasks for account (called by extension)
   */
  async getTasksForAccount(accountId: string): Promise<MarketplaceTask[]> {
    const tasks = await prisma.extensionTask.findMany({
      where: {
        accountId,
        status: 'pending',
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });
    
    return tasks.map(t => ({
      id: t.id,
      type: t.type as MarketplaceTask['type'],
      accountId: t.accountId,
      data: t.data,
      status: t.status as MarketplaceTask['status'],
      retries: t.retryCount,
      createdAt: t.createdAt,
    }));
  }
  
  /**
   * Update task status (called by extension after execution)
   */
  async updateTaskStatus(
    taskId: string, 
    status: MarketplaceTask['status'], 
    result?: any
  ): Promise<void> {
    await prisma.extensionTask.update({
      where: { id: taskId },
      data: {
        status,
        result,
        completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined,
      },
    });
    
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
    }
    
    logger.info(`Task ${taskId} updated to ${status}`);
  }
  
  /**
   * Subscribe to tasks for account (long polling)
   */
  subscribeToAccount(accountId: string, callback: (task: MarketplaceTask) => void): () => void {
    this.listeners.set(accountId, callback);
    return () => this.listeners.delete(accountId);
  }
}

// ============================================
// AI Navigation Commands (sent to extension)
// ============================================

export interface NavigationCommand {
  action: 'navigate' | 'click' | 'type' | 'upload' | 'select' | 'wait' | 'scrape' | 'screenshot';
  target?: string; // CSS selector or description for AI
  value?: string;
  options?: {
    humanlike?: boolean;
    delay?: number;
    retryOnFail?: boolean;
    useAI?: boolean; // Use AI to find element if selector fails
  };
}

export interface PostVehicleCommand {
  type: 'post_vehicle';
  vehicle: {
    title: string;
    price: number;
    year: number;
    make: string;
    model: string;
    mileage: number;
    vin?: string;
    description: string;
    images: string[];
    location: string;
  };
  accountId: string;
}

export interface ScrapeMessagesCommand {
  type: 'scrape_messages';
  accountId: string;
  since?: Date;
}

export interface RespondToLeadCommand {
  type: 'respond_to_lead';
  conversationId: string;
  message: string;
  accountId: string;
}

// ============================================
// Hybrid Facebook Service
// ============================================

export class HybridFacebookService {
  private oauth: FacebookOAuthService;
  private taskQueue: ExtensionTaskQueue;
  
  constructor() {
    this.oauth = new FacebookOAuthService();
    this.taskQueue = new ExtensionTaskQueue();
  }
  
  // ---- OAuth Methods ----
  
  getAuthUrl(state: string) {
    return this.oauth.getAuthUrl(state);
  }
  
  async handleCallback(code: string) {
    return this.oauth.getAccessToken(code);
  }
  
  async getUserProfile(accessToken: string) {
    return this.oauth.getUserProfile(accessToken);
  }
  
  // ---- Extension Task Methods ----
  
  /**
   * Queue vehicle posting task for extension
   */
  async queueVehiclePost(accountId: string, vehicle: PostVehicleCommand['vehicle']): Promise<string> {
    return this.taskQueue.addTask({
      type: 'post',
      accountId,
      data: {
        commands: this.generatePostCommands(vehicle),
        vehicle,
      },
    });
  }
  
  /**
   * Queue message scraping task
   */
  async queueMessageScrape(accountId: string): Promise<string> {
    return this.taskQueue.addTask({
      type: 'scrape',
      accountId,
      data: {
        target: 'marketplace_inbox',
        extractFields: ['senderName', 'message', 'timestamp', 'vehicleId'],
      },
    });
  }
  
  /**
   * Queue lead response task
   */
  async queueLeadResponse(accountId: string, conversationId: string, message: string): Promise<string> {
    return this.taskQueue.addTask({
      type: 'message',
      accountId,
      data: {
        conversationId,
        message,
        commands: this.generateMessageCommands(conversationId, message),
      },
    });
  }
  
  /**
   * Get pending tasks for extension polling
   */
  async getPendingTasks(accountId: string) {
    return this.taskQueue.getTasksForAccount(accountId);
  }
  
  /**
   * Report task completion from extension
   */
  async reportTaskComplete(taskId: string, result: any) {
    await this.taskQueue.updateTaskStatus(taskId, 'completed', result);
  }
  
  /**
   * Report task failure from extension
   */
  async reportTaskFailed(taskId: string, error: string) {
    await this.taskQueue.updateTaskStatus(taskId, 'failed', { error });
  }
  
  // ---- Navigation Command Generators ----
  
  /**
   * Generate navigation commands for posting a vehicle
   */
  private generatePostCommands(vehicle: PostVehicleCommand['vehicle']): NavigationCommand[] {
    return [
      // Navigate to Marketplace create listing
      {
        action: 'navigate',
        target: 'https://www.facebook.com/marketplace/create/vehicle',
        options: { delay: 2000 },
      },
      // Wait for page load
      {
        action: 'wait',
        target: '[aria-label="Listing title"], [placeholder*="title"], input[name="title"]',
        options: { useAI: true },
      },
      // Fill title
      {
        action: 'type',
        target: 'listing title input',
        value: vehicle.title,
        options: { humanlike: true, useAI: true },
      },
      // Fill price
      {
        action: 'type',
        target: 'price input',
        value: vehicle.price.toString(),
        options: { humanlike: true, useAI: true },
      },
      // Select year
      {
        action: 'select',
        target: 'year dropdown',
        value: vehicle.year.toString(),
        options: { useAI: true },
      },
      // Select make
      {
        action: 'select',
        target: 'make dropdown',
        value: vehicle.make,
        options: { useAI: true },
      },
      // Select model
      {
        action: 'select',
        target: 'model dropdown',
        value: vehicle.model,
        options: { useAI: true },
      },
      // Fill mileage
      {
        action: 'type',
        target: 'mileage input',
        value: vehicle.mileage.toString(),
        options: { humanlike: true, useAI: true },
      },
      // Fill VIN if provided
      ...(vehicle.vin ? [{
        action: 'type' as const,
        target: 'VIN input',
        value: vehicle.vin,
        options: { humanlike: true, useAI: true },
      }] : []),
      // Fill description
      {
        action: 'type',
        target: 'description textarea',
        value: vehicle.description,
        options: { humanlike: true, useAI: true, delay: 50 },
      },
      // Upload photos
      {
        action: 'upload',
        target: 'photo upload input',
        value: JSON.stringify(vehicle.images),
        options: { useAI: true },
      },
      // Wait for photos to upload
      {
        action: 'wait',
        target: 'photos uploaded indicator',
        options: { delay: 5000, useAI: true },
      },
      // Click publish
      {
        action: 'click',
        target: 'publish/next button',
        options: { useAI: true, delay: 1000 },
      },
      // Verify success
      {
        action: 'wait',
        target: 'success message or listing confirmation',
        options: { useAI: true, delay: 3000 },
      },
    ];
  }
  
  /**
   * Generate commands for sending a message
   */
  private generateMessageCommands(conversationId: string, message: string): NavigationCommand[] {
    return [
      {
        action: 'navigate',
        target: `https://www.facebook.com/marketplace/inbox/?thread_id=${conversationId}`,
        options: { delay: 1500 },
      },
      {
        action: 'wait',
        target: 'message input box',
        options: { useAI: true },
      },
      {
        action: 'type',
        target: 'message input',
        value: message,
        options: { humanlike: true, useAI: true },
      },
      {
        action: 'click',
        target: 'send button',
        options: { useAI: true, delay: 500 },
      },
    ];
  }
  
  /**
   * Generate commands for scraping inbox
   */
  generateScrapeCommands(): NavigationCommand[] {
    return [
      {
        action: 'navigate',
        target: 'https://www.facebook.com/marketplace/inbox',
        options: { delay: 2000 },
      },
      {
        action: 'wait',
        target: 'conversation list',
        options: { useAI: true },
      },
      {
        action: 'scrape',
        target: 'all conversations',
        options: {
          useAI: true,
        },
      },
    ];
  }
}

// ============================================
// Pixel Event Tracking
// ============================================

export class PixelTracker {
  private pixelId = FACEBOOK_CONFIG.pixel.id;
  
  /**
   * Generate pixel event code for client
   */
  getPixelInitCode(): string {
    return `
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${this.pixelId}');
      fbq('track', 'PageView');
    `;
  }
  
  /**
   * Generate server-side pixel event
   */
  async trackServerEvent(event: string, data: any, userToken?: string) {
    // Server-side Conversions API
    try {
      const eventData = {
        data: [{
          event_name: event,
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'website',
          user_data: data.userData || {},
          custom_data: data.customData || {},
        }],
      };
      
      if (userToken) {
        await axios.post(
          `${FACEBOOK_CONFIG.api.baseUrl}/${this.pixelId}/events`,
          eventData,
          {
            params: { access_token: userToken },
          }
        );
      }
      
      logger.info(`Pixel event tracked: ${event}`);
    } catch (error) {
      logger.error('Failed to track pixel event:', error);
    }
  }
}

// ============================================
// Export Services
// ============================================

export const facebookOAuth = new FacebookOAuthService();
export const extensionTaskQueue = new ExtensionTaskQueue();
export const hybridFacebook = new HybridFacebookService();
export const pixelTracker = new PixelTracker();

export default {
  oauth: facebookOAuth,
  taskQueue: extensionTaskQueue,
  hybrid: hybridFacebook,
  pixel: pixelTracker,
  config: FACEBOOK_CONFIG,
};
