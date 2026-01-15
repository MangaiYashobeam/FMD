import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export const accountSettingsController = {
  // Get account settings
  async getSettings(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { account: true },
      });

      if (!user || !user.account) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }

      const settings = {
        aiEnabled: user.account.aiEnabled,
        aiModel: user.account.aiModel,
        aiTemperature: user.account.aiTemperature,
        aiMaxTokens: user.account.aiMaxTokens,
        autoPostEnabled: user.account.autoPostEnabled,
        autoPostInterval: user.account.autoPostInterval,
        ftpHost: user.account.ftpHost,
        ftpPort: user.account.ftpPort,
        ftpUsername: user.account.ftpUsername,
        csvPath: user.account.csvPath,
        autoSync: user.account.autoSync,
        syncInterval: user.account.syncInterval,
      };

      res.json({ success: true, data: settings });
    } catch (error) {
      console.error('Get settings error:', error);
      res.status(500).json({ success: false, message: 'Failed to get settings' });
    }
  },

  // Update account settings
  async updateSettings(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { account: true },
      });

      if (!user || !user.account) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }

      const {
        aiEnabled,
        aiModel,
        aiTemperature,
        aiMaxTokens,
        autoPostEnabled,
        autoPostInterval,
        ftpHost,
        ftpPort,
        ftpUsername,
        ftpPassword,
        csvPath,
        autoSync,
        syncInterval,
      } = req.body;

      const updateData: any = {
        aiEnabled,
        aiModel,
        aiTemperature,
        aiMaxTokens,
        autoPostEnabled,
        autoPostInterval,
        ftpHost,
        ftpPort,
        ftpUsername,
        csvPath,
        autoSync,
        syncInterval,
      };

      // Only update FTP password if provided
      if (ftpPassword) {
        updateData.ftpPassword = ftpPassword;
      }

      const updatedAccount = await prisma.account.update({
        where: { id: user.account.id },
        data: updateData,
      });

      res.json({ success: true, data: updatedAccount });
    } catch (error) {
      console.error('Update settings error:', error);
      res.status(500).json({ success: false, message: 'Failed to update settings' });
    }
  },

  // Get templates
  async getTemplates(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const templates = await prisma.descriptionTemplate.findMany({
        where: { accountId: user.accountId },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ success: true, data: templates });
    } catch (error) {
      console.error('Get templates error:', error);
      res.status(500).json({ success: false, message: 'Failed to get templates' });
    }
  },

  // Create template
  async createTemplate(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const { name, content, isDefault } = req.body;

      // If this template is set as default, unset other defaults
      if (isDefault) {
        await prisma.descriptionTemplate.updateMany({
          where: {
            accountId: user.accountId,
            isDefault: true,
          },
          data: { isDefault: false },
        });
      }

      const template = await prisma.descriptionTemplate.create({
        data: {
          name,
          content,
          isDefault: isDefault || false,
          accountId: user.accountId,
        },
      });

      res.json({ success: true, data: template });
    } catch (error) {
      console.error('Create template error:', error);
      res.status(500).json({ success: false, message: 'Failed to create template' });
    }
  },

  // Update template
  async updateTemplate(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { id } = req.params;
      const { name, content, isDefault } = req.body;

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Verify template belongs to user's account
      const existingTemplate = await prisma.descriptionTemplate.findFirst({
        where: {
          id,
          accountId: user.accountId,
        },
      });

      if (!existingTemplate) {
        return res.status(404).json({ success: false, message: 'Template not found' });
      }

      // If this template is set as default, unset other defaults
      if (isDefault) {
        await prisma.descriptionTemplate.updateMany({
          where: {
            accountId: user.accountId,
            isDefault: true,
            id: { not: id },
          },
          data: { isDefault: false },
        });
      }

      const template = await prisma.descriptionTemplate.update({
        where: { id },
        data: { name, content, isDefault },
      });

      res.json({ success: true, data: template });
    } catch (error) {
      console.error('Update template error:', error);
      res.status(500).json({ success: false, message: 'Failed to update template' });
    }
  },

  // Delete template
  async deleteTemplate(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Verify template belongs to user's account
      const template = await prisma.descriptionTemplate.findFirst({
        where: {
          id,
          accountId: user.accountId,
        },
      });

      if (!template) {
        return res.status(404).json({ success: false, message: 'Template not found' });
      }

      await prisma.descriptionTemplate.delete({
        where: { id },
      });

      res.json({ success: true, message: 'Template deleted successfully' });
    } catch (error) {
      console.error('Delete template error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete template' });
    }
  },

  // Get users (team members)
  async getUsers(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const users = await prisma.user.findMany({
        where: { accountId: user.accountId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ success: true, data: users });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ success: false, message: 'Failed to get users' });
    }
  },

  // Create user (team member)
  async createUser(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { account: true },
      });

      if (!user || !user.account) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }

      const { email, firstName, lastName, role } = req.body;

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return res.status(400).json({ success: false, message: 'User already exists' });
      }

      // Generate temporary password
      const tempPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      const newUser = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          role,
          accountId: user.accountId,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
        },
      });

      // TODO: Send email with temporary password
      // await sendWelcomeEmail(email, tempPassword);

      res.json({ 
        success: true, 
        data: newUser,
        message: `User created. Temporary password: ${tempPassword}` 
      });
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({ success: false, message: 'Failed to create user' });
    }
  },

  // Delete user (team member)
  async deleteUser(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Verify user belongs to same account
      const targetUser = await prisma.user.findFirst({
        where: {
          id,
          accountId: user.accountId,
        },
      });

      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Cannot delete yourself
      if (targetUser.id === userId) {
        return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
      }

      await prisma.user.delete({
        where: { id },
      });

      res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
  },

  // Get current account info
  async getCurrentAccount(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          account: {
            include: {
              subscription: {
                include: {
                  plan: true,
                },
              },
            },
          },
        },
      });

      if (!user || !user.account) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }

      // Get user count
      const userCount = await prisma.user.count({
        where: { accountId: user.accountId },
      });

      const accountInfo = {
        id: user.account.id,
        name: user.account.name,
        dealershipName: user.account.dealershipName,
        subscription: user.account.subscription ? {
          status: user.account.subscription.status,
          planName: user.account.subscription.plan.name,
          currentPeriodEnd: user.account.subscription.currentPeriodEnd,
        } : null,
        userCount,
      };

      res.json({ success: true, data: accountInfo });
    } catch (error) {
      console.error('Get current account error:', error);
      res.status(500).json({ success: false, message: 'Failed to get account info' });
    }
  },
};
