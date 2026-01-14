import { Client } from 'basic-ftp';
import fs from 'fs';
import path from 'path';
import { logger } from '@/utils/logger';
import crypto from 'crypto';

export interface FTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  path: string;
  protocol: 'ftp' | 'ftps';
  secure?: boolean;
}

export class FTPService {
  private client: Client;

  constructor() {
    this.client = new Client();
    this.client.ftp.verbose = process.env.NODE_ENV === 'development';
  }

  /**
   * Connect to FTP server
   */
  async connect(config: FTPConfig): Promise<void> {
    try {
      await this.client.access({
        host: config.host,
        port: config.port,
        user: config.username,
        password: this.decryptPassword(config.password),
        secure: config.protocol === 'ftps',
      });

      logger.info(`Connected to FTP server: ${config.host}`);
    } catch (error) {
      logger.error('FTP connection failed:', error);
      throw new Error(`FTP connection failed: ${error}`);
    }
  }

  /**
   * Download file from FTP server
   */
  async downloadFile(remotePath: string, localPath: string): Promise<string> {
    try {
      const dir = path.dirname(localPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      await this.client.downloadTo(localPath, remotePath);
      logger.info(`Downloaded file from FTP: ${remotePath} -> ${localPath}`);
      return localPath;
    } catch (error) {
      logger.error(`FTP download failed: ${remotePath}`, error);
      throw new Error(`FTP download failed: ${error}`);
    }
  }

  /**
   * List files in FTP directory
   */
  async listFiles(remotePath: string): Promise<string[]> {
    try {
      const files = await this.client.list(remotePath);
      return files
        .filter((file) => file.type === 1) // Only files, not directories
        .map((file) => file.name);
    } catch (error) {
      logger.error(`FTP list failed: ${remotePath}`, error);
      throw new Error(`FTP list failed: ${error}`);
    }
  }

  /**
   * Find CSV files in directory
   */
  async findCSVFiles(remotePath: string): Promise<string[]> {
    const files = await this.listFiles(remotePath);
    return files.filter((file) => file.toLowerCase().endsWith('.csv'));
  }

  /**
   * Download latest CSV file
   */
  async downloadLatestCSV(remotePath: string, localDir: string): Promise<string> {
    const csvFiles = await this.findCSVFiles(remotePath);

    if (csvFiles.length === 0) {
      throw new Error('No CSV files found on FTP server');
    }

    // Sort by name (assuming names include timestamps or are ordered)
    csvFiles.sort().reverse();
    const latestFile = csvFiles[0];

    const localPath = path.join(localDir, latestFile);
    const remoteFilePath = `${remotePath}/${latestFile}`;

    await this.downloadFile(remoteFilePath, localPath);
    return localPath;
  }

  /**
   * Test FTP connection
   */
  async testConnection(config: FTPConfig): Promise<boolean> {
    try {
      await this.connect(config);
      await this.client.list(config.path);
      await this.disconnect();
      return true;
    } catch (error) {
      logger.error('FTP connection test failed:', error);
      return false;
    }
  }

  /**
   * Disconnect from FTP server
   */
  async disconnect(): Promise<void> {
    try {
      this.client.close();
      logger.info('Disconnected from FTP server');
    } catch (error) {
      logger.error('FTP disconnect error:', error);
    }
  }

  /**
   * Encrypt password for storage
   */
  static encryptPassword(password: string): string {
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default-key-32-characters-long', 'utf8');
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key.slice(0, 32), iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt password from storage
   */
  private decryptPassword(encryptedPassword: string): string {
    try {
      const algorithm = 'aes-256-cbc';
      const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default-key-32-characters-long', 'utf8');

      const parts = encryptedPassword.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      const decipher = crypto.createDecipheriv(algorithm, key.slice(0, 32), iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Password decryption failed:', error);
      // Return as-is if decryption fails (might be unencrypted for dev)
      return encryptedPassword;
    }
  }
}
