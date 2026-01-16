/**
 * IIPC Controller
 * 
 * API endpoints for managing the Internal IP Controller
 */

import { Request, Response } from 'express';
import { iipcService, IPAccessLevel, IPRuleScope } from '@/services/iipc.service';
import { logger } from '@/utils/logger';

class IIPCController {
  /**
   * Get full IIPC status (Super Admin only)
   */
  async getStatus(req: Request, res: Response) {
    try {
      const status = iipcService.getStatus();
      const rules = iipcService.getAllRules();

      res.json({
        success: true,
        data: {
          ...status,
          rules,
          clientIP: req.iipc?.clientIP || req.ip,
        },
      });
    } catch (error) {
      logger.error('IIPC getStatus error:', error);
      res.status(500).json({ success: false, error: 'Failed to get IIPC status' });
    }
  }

  /**
   * Get IIPC configuration
   */
  async getConfig(_req: Request, res: Response) {
    try {
      const config = iipcService.getConfig();
      res.json({ success: true, data: config });
    } catch (error) {
      logger.error('IIPC getConfig error:', error);
      res.status(500).json({ success: false, error: 'Failed to get configuration' });
    }
  }

  /**
   * Update IIPC configuration
   */
  async updateConfig(req: Request, res: Response) {
    try {
      const updates = req.body;
      await iipcService.updateConfig(updates);
      
      const config = iipcService.getConfig();
      res.json({ success: true, data: config, message: 'Configuration updated' });
    } catch (error) {
      logger.error('IIPC updateConfig error:', error);
      res.status(500).json({ success: false, error: 'Failed to update configuration' });
    }
  }

  /**
   * Get all role settings
   */
  async getRoleSettings(_req: Request, res: Response) {
    try {
      const settings = iipcService.getAllRoleSettings();
      res.json({ success: true, data: settings });
    } catch (error) {
      logger.error('IIPC getRoleSettings error:', error);
      res.status(500).json({ success: false, error: 'Failed to get role settings' });
    }
  }

  /**
   * Update role settings
   */
  async updateRoleSettings(req: Request, res: Response): Promise<void> {
    try {
      const { role, settings } = req.body;
      
      if (!role || !['SUPER_ADMIN', 'ADMIN', 'DEALER', 'SALES_REP', 'USER'].includes(role)) {
        res.status(400).json({ success: false, error: 'Invalid role' });
        return;
      }

      await iipcService.updateRoleSettings(role as IPAccessLevel, settings);
      
      const allSettings = iipcService.getAllRoleSettings();
      res.json({ success: true, data: allSettings, message: 'Role settings updated' });
    } catch (error) {
      logger.error('IIPC updateRoleSettings error:', error);
      res.status(500).json({ success: false, error: 'Failed to update role settings' });
    }
  }

  /**
   * Get all IP rules
   */
  async getRules(req: Request, res: Response) {
    try {
      const { scope, scopeValue } = req.query;
      
      let rules;
      if (scope) {
        rules = iipcService.getRulesByScope(scope as IPRuleScope, scopeValue as string);
      } else {
        rules = iipcService.getAllRules();
      }

      res.json({ success: true, data: rules });
    } catch (error) {
      logger.error('IIPC getRules error:', error);
      res.status(500).json({ success: false, error: 'Failed to get rules' });
    }
  }

  /**
   * Add new IP rule
   */
  async addRule(req: Request, res: Response): Promise<void> {
    try {
      const { 
        ip, 
        type, 
        scope, 
        scopeValue, 
        computerName,
        description, 
        canOverrideRateLimit,
        canOverrideLoginBlock,
        canOverrideAllSecurity,
        expiresAt,
      } = req.body;

      if (!ip) {
        res.status(400).json({ success: false, error: 'IP address required' });
        return;
      }

      const userId = (req as any).user?.id || 'system';

      const rule = await iipcService.addIPRule({
        ip,
        type: type || 'WHITELIST',
        scope: scope || 'USER',
        scopeValue,
        computerName,
        description,
        canOverrideRateLimit: canOverrideRateLimit ?? true,
        canOverrideLoginBlock: canOverrideLoginBlock ?? false,
        canOverrideAllSecurity: canOverrideAllSecurity ?? false,
        createdBy: userId,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        isActive: true,
      });

      res.json({ success: true, data: rule, message: 'IP rule added' });
    } catch (error) {
      logger.error('IIPC addRule error:', error);
      res.status(500).json({ success: false, error: 'Failed to add rule' });
    }
  }

  /**
   * Update IP rule
   */
  async updateRule(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      const rule = await iipcService.updateIPRule(id as string, updates);
      
      if (!rule) {
        res.status(404).json({ success: false, error: 'Rule not found' });
        return;
      }

      res.json({ success: true, data: rule, message: 'Rule updated' });
    } catch (error) {
      logger.error('IIPC updateRule error:', error);
      res.status(500).json({ success: false, error: 'Failed to update rule' });
    }
  }

  /**
   * Delete IP rule
   */
  async deleteRule(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const deleted = await iipcService.deleteIPRule(id as string);
      
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Rule not found' });
        return;
      }

      res.json({ success: true, message: 'Rule deleted' });
    } catch (error) {
      logger.error('IIPC deleteRule error:', error);
      res.status(500).json({ success: false, error: 'Failed to delete rule' });
    }
  }

  /**
   * Get super admin IPs
   */
  async getSuperAdminIPs(_req: Request, res: Response) {
    try {
      const ips = iipcService.getSuperAdminIPs();
      res.json({ success: true, data: ips });
    } catch (error) {
      logger.error('IIPC getSuperAdminIPs error:', error);
      res.status(500).json({ success: false, error: 'Failed to get super admin IPs' });
    }
  }

  /**
   * Add super admin IP
   */
  async addSuperAdminIP(req: Request, res: Response): Promise<void> {
    try {
      const { ip } = req.body;
      
      if (!ip) {
        res.status(400).json({ success: false, error: 'IP address required' });
        return;
      }

      await iipcService.addSuperAdminIP(ip);
      
      const ips = iipcService.getSuperAdminIPs();
      res.json({ success: true, data: ips, message: 'Super admin IP added' });
    } catch (error) {
      logger.error('IIPC addSuperAdminIP error:', error);
      res.status(500).json({ success: false, error: 'Failed to add super admin IP' });
    }
  }

  /**
   * Remove super admin IP
   */
  async removeSuperAdminIP(req: Request, res: Response): Promise<void> {
    try {
      const { ip } = req.body;
      
      if (!ip) {
        res.status(400).json({ success: false, error: 'IP address required' });
        return;
      }

      await iipcService.removeSuperAdminIP(ip);
      
      const ips = iipcService.getSuperAdminIPs();
      res.json({ success: true, data: ips, message: 'Super admin IP removed' });
    } catch (error) {
      logger.error('IIPC removeSuperAdminIP error:', error);
      res.status(500).json({ success: false, error: 'Failed to remove super admin IP' });
    }
  }

  /**
   * Request emergency access
   */
  async requestEmergencyAccess(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.body;
      const ip = req.iipc?.clientIP || req.ip || 'unknown';

      if (!userId) {
        res.status(400).json({ success: false, error: 'User ID required' });
        return;
      }

      const result = await iipcService.requestEmergencyAccess(userId, ip);
      
      if (!result.success) {
        res.status(400).json({ success: false, error: result.message });
        return;
      }

      res.json({ 
        success: true, 
        data: { verificationId: result.verificationId },
        message: result.message,
      });
    } catch (error) {
      logger.error('IIPC requestEmergencyAccess error:', error);
      res.status(500).json({ success: false, error: 'Failed to request emergency access' });
    }
  }

  /**
   * Verify emergency access
   */
  async verifyEmergencyAccess(req: Request, res: Response): Promise<void> {
    try {
      const { verificationId, code } = req.body;

      if (!verificationId || !code) {
        res.status(400).json({ success: false, error: 'Verification ID and code required' });
        return;
      }

      const result = await iipcService.verifyEmergencyAccess(verificationId, code);
      
      if (!result.success) {
        res.status(400).json({ success: false, error: result.message });
        return;
      }

      res.json({ success: true, message: result.message });
    } catch (error) {
      logger.error('IIPC verifyEmergencyAccess error:', error);
      res.status(500).json({ success: false, error: 'Failed to verify emergency access' });
    }
  }

  /**
   * Whitelist own IP (self-service for users)
   */
  async whitelistOwnIP(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role as IPAccessLevel || 'USER';
      const ip = req.body.ip || req.iipc?.clientIP || req.ip;
      const description = req.body.description;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const result = await iipcService.whitelistUserIP(userId, userRole, ip, description);
      
      if (!result.success) {
        res.status(400).json({ success: false, error: result.message });
        return;
      }

      res.json({ success: true, data: result.rule, message: result.message });
    } catch (error) {
      logger.error('IIPC whitelistOwnIP error:', error);
      res.status(500).json({ success: false, error: 'Failed to whitelist IP' });
    }
  }

  /**
   * Get user's whitelisted IPs
   */
  async getUserIPs(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId || (req as any).user?.id;
      
      if (!userId) {
        res.status(400).json({ success: false, error: 'User ID required' });
        return;
      }

      const ips = iipcService.getUserWhitelistedIPs(userId);
      const rules = iipcService.getRulesByScope('USER', userId);

      res.json({ success: true, data: { ips, rules } });
    } catch (error) {
      logger.error('IIPC getUserIPs error:', error);
      res.status(500).json({ success: false, error: 'Failed to get user IPs' });
    }
  }

  /**
   * Check if current IP is allowed
   */
  async checkCurrentIP(req: Request, res: Response) {
    try {
      const ip = req.iipc?.clientIP || req.ip || 'unknown';
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role as IPAccessLevel;

      const result = iipcService.checkIPAccess({
        ip,
        userId,
        userRole,
      });

      res.json({
        success: true,
        data: {
          ip,
          ...result,
        },
      });
    } catch (error) {
      logger.error('IIPC checkCurrentIP error:', error);
      res.status(500).json({ success: false, error: 'Failed to check IP' });
    }
  }
}

export const iipcController = new IIPCController();
export default iipcController;
