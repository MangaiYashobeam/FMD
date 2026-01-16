/**
 * Intelliceil Controller
 * 
 * API endpoints for the Intelliceil security dashboard
 */

import { Request, Response } from 'express';
import { intelliceilService, IntelliceilConfig } from '@/services/intelliceil.service';
import { logger } from '@/utils/logger';

// Get Intelliceil status
export const getStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = intelliceilService.getStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Failed to get Intelliceil status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get security status',
    });
  }
};

// Get configuration
export const getConfig = async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = intelliceilService.getConfig();
    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.error('Failed to get Intelliceil config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get configuration',
    });
  }
};

// Update configuration
export const updateConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const updates: Partial<IntelliceilConfig> = req.body;
    
    // Validate updates
    if (updates.alertThreshold !== undefined && (updates.alertThreshold < 1 || updates.alertThreshold > 100)) {
      res.status(400).json({
        success: false,
        error: 'Alert threshold must be between 1 and 100',
      });
      return;
    }

    if (updates.mitigationThreshold !== undefined && (updates.mitigationThreshold < 1 || updates.mitigationThreshold > 100)) {
      res.status(400).json({
        success: false,
        error: 'Mitigation threshold must be between 1 and 100',
      });
      return;
    }

    await intelliceilService.updateConfig(updates);
    
    res.json({
      success: true,
      message: 'Configuration updated',
      data: intelliceilService.getConfig(),
    });
  } catch (error) {
    logger.error('Failed to update Intelliceil config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update configuration',
    });
  }
};

// Block an IP
export const blockIP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ip } = req.body;
    
    if (!ip) {
      res.status(400).json({
        success: false,
        error: 'IP address is required',
      });
      return;
    }

    intelliceilService.manualBlock(ip);
    logger.info(`Intelliceil: IP ${ip} manually blocked`);
    
    res.json({
      success: true,
      message: `IP ${ip} has been blocked`,
    });
  } catch (error) {
    logger.error('Failed to block IP:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to block IP',
    });
  }
};

// Unblock an IP
export const unblockIP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ip } = req.body;
    
    if (!ip) {
      res.status(400).json({
        success: false,
        error: 'IP address is required',
      });
      return;
    }

    intelliceilService.manualUnblock(ip);
    logger.info(`Intelliceil: IP ${ip} manually unblocked`);
    
    res.json({
      success: true,
      message: `IP ${ip} has been unblocked`,
    });
  } catch (error) {
    logger.error('Failed to unblock IP:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unblock IP',
    });
  }
};

// Activate mitigation
export const activateMitigation = async (_req: Request, res: Response): Promise<void> => {
  try {
    intelliceilService.manualActivateMitigation();
    logger.warn('Intelliceil: Mitigation manually activated');
    
    res.json({
      success: true,
      message: 'Mitigation mode activated',
    });
  } catch (error) {
    logger.error('Failed to activate mitigation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to activate mitigation',
    });
  }
};

// Deactivate mitigation
export const deactivateMitigation = async (_req: Request, res: Response): Promise<void> => {
  try {
    intelliceilService.manualDeactivateMitigation();
    logger.info('Intelliceil: Mitigation manually deactivated');
    
    res.json({
      success: true,
      message: 'Mitigation mode deactivated',
    });
  } catch (error) {
    logger.error('Failed to deactivate mitigation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate mitigation',
    });
  }
};

// Add trusted domain
export const addTrustedDomain = async (req: Request, res: Response): Promise<void> => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      res.status(400).json({
        success: false,
        error: 'Domain is required',
      });
      return;
    }

    intelliceilService.addTrustedDomain(domain);
    logger.info(`Intelliceil: Domain ${domain} added to trusted list`);
    
    res.json({
      success: true,
      message: `Domain ${domain} added to trusted list`,
    });
  } catch (error) {
    logger.error('Failed to add trusted domain:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add trusted domain',
    });
  }
};

// Remove trusted domain
export const removeTrustedDomain = async (req: Request, res: Response): Promise<void> => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      res.status(400).json({
        success: false,
        error: 'Domain is required',
      });
      return;
    }

    intelliceilService.removeTrustedDomain(domain);
    logger.info(`Intelliceil: Domain ${domain} removed from trusted list`);
    
    res.json({
      success: true,
      message: `Domain ${domain} removed from trusted list`,
    });
  } catch (error) {
    logger.error('Failed to remove trusted domain:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove trusted domain',
    });
  }
};

// Get geo locations for map
export const getGeoLocations = async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = intelliceilService.getStatus();
    res.json({
      success: true,
      data: {
        locations: status.geoLocations,
        threatLevel: status.threatLevel,
      },
    });
  } catch (error) {
    logger.error('Failed to get geo locations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get geo locations',
    });
  }
};

// Get traffic history for charts
export const getTrafficHistory = async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = intelliceilService.getStatus();
    res.json({
      success: true,
      data: {
        history: status.trafficHistory,
        baseline: status.baseline,
        currentRps: status.currentRps,
      },
    });
  } catch (error) {
    logger.error('Failed to get traffic history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get traffic history',
    });
  }
};

export default {
  getStatus,
  getConfig,
  updateConfig,
  blockIP,
  unblockIP,
  activateMitigation,
  deactivateMitigation,
  addTrustedDomain,
  removeTrustedDomain,
  getGeoLocations,
  getTrafficHistory,
};
