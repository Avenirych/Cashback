import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

type MailMode = 'smtp' | 'ethereal' | 'preview';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger(MailService.name);
  private readonly initPromise: Promise<void>;
  private mode: MailMode = 'preview';

  constructor() {
    this.initPromise = this.initializeTransporter();
  }

  private get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  private async initializeTransporter(): Promise<void> {
    try {
      // Real SMTP: used whenever SMTP_HOST is configured.
      if (process.env.SMTP_HOST) {
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        });
        this.mode = 'smtp';
        this.logger.log('Mail service initialized (SMTP)');
        return;
      }

      if (this.isProduction) {
        this.logger.error('SMTP_HOST is not configured in production');
        return;
      }

      // Development: Ethereal only if explicitly enabled.
      if (process.env.USE_ETHEREAL === 'true') {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: { user: testAccount.user, pass: testAccount.pass },
        });
        this.mode = 'ethereal';
        this.logger.log(
          `Mail service initialized (Ethereal). Test account: ${testAccount.user}`,
        );
        return;
      }

      // Development default: no network, link is returned in the API response.
      this.mode = 'preview';
      this.logger.log(
        'Mail service initialized (local preview: no email is sent over the network)',
      );
    } catch (error) {
      this.transporter = null;
      this.logger.error(`Failed to initialize mail transporter: ${error}`);
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Returns a preview URL in development (Ethereal URL or the verification
   * link itself in local preview mode). Returns null for real SMTP.
   * Throws if sending fails.
   */
  async sendVerificationEmail(
    email: string,
    token: string,
    userName: string,
  ): Promise<string | null> {
    await this.initPromise;

    const frontendUrl =
      process.env.FRONTEND_URL || 'http://localhost:3000';
    const link = `${frontendUrl}/verify-email?token=${encodeURIComponent(
      token,
    )}`;

    if (this.mode === 'preview') {
      if (this.isProduction) {
        throw new Error('Mail transporter is not configured');
      }
      this.logger.log(
        `[local preview] Verification link for ${email}: ${link}`,
      );
      return link;
    }

    if (!this.transporter) {
      throw new Error('Mail transporter is not initialized');
    }

    const safeName = this.escapeHtml(userName);

    const info = await this.transporter.sendMail({
      from:
        process.env.SMTP_FROM ||
        'Cashback+ <noreply@cashback-plus.app>',
      to: email,
      subject: 'Verify your email address — Cashback+',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0d6efd;">Welcome to Cashback+, ${safeName}!</h2>
          <p>Please verify your email address to activate your account.</p>
          <p style="margin: 24px 0;">
            <a href="${link}" style="display:inline-block;padding:12px 24px;background:#0d6efd;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
              Verify Email
            </a>
          </p>
          <p>Or copy this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${link}</p>
          <hr style="margin: 24px 0; border: none; border-top: 1px solid #ddd;">
          <p style="font-size: 12px; color: #999;">
            This link expires in 24 hours. If you did not create this account, ignore this email.
          </p>
        </div>
      `,
    });

    if (this.mode === 'ethereal') {
      const previewUrl = nodemailer.getTestMessageUrl(info) || null;
      this.logger.log(`Verification email preview: ${previewUrl}`);
      return previewUrl;
    }

    this.logger.log(`Verification email sent to ${email}`);
    return null;
  }

  async sendResendVerificationEmail(
    email: string,
    token: string,
    userName: string,
  ): Promise<string | null> {
    return this.sendVerificationEmail(email, token, userName);
  }
}