import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';
jest.mock('nodemailer', () => ({ createTransport: jest.fn(), createTestAccount: jest.fn(), getTestMessageUrl: jest.fn() }));

describe('Mail diagnostic capability isolation', () => {
  const keys = [
    'NODE_ENV', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER',
    'SMTP_PASSWORD', 'SMTP_FROM', 'USE_ETHEREAL', 'FRONTEND_URL',
    'LOCAL_DEMO_MAILPIT', 'LOCAL_DEMO_SCENARIO',
    'DB_HOST', 'DB_PORT', 'DB_NAME', 'DATABASE_URL',
  ];
  let saved: Record<string, string | undefined>;
  const markers = ['synthetic-recipient@example.test', 'synthetic-smtp-password', 'synthetic-reset-token', 'synthetic-raw-error', 'https://synthetic.invalid', 'f'.repeat(64)];
  const sendMail = jest.fn();
  let spies: jest.SpyInstance[];
  beforeEach(() => {
    saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
    jest.clearAllMocks(); keys.forEach(k => delete process.env[k]);
    process.env.NODE_ENV = 'development'; process.env.FRONTEND_URL = markers[4];
    spies = ['log', 'error', 'warn', 'debug', 'verbose'].map(method => jest.spyOn(Logger.prototype, method as 'log').mockImplementation(() => {}));
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
    (nodemailer.createTestAccount as jest.Mock).mockResolvedValue({ user: markers[0], pass: markers[1] });
    (nodemailer.getTestMessageUrl as jest.Mock).mockReturnValue(markers[4] + '/preview/' + markers[5]);
    sendMail.mockResolvedValue({ messageId: 'synthetic' });
  });
  afterEach(() => {
    try {
      const diagnostics = JSON.stringify(spies.map(s => s.mock.calls));
      for (const marker of markers) expect(diagnostics).not.toContain(marker);
    } finally {
      try { spies.forEach(s => s.mockRestore()); }
      finally {
        for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
      }
    }
  });
  it('refuses preview delivery without exposing a verification link', async () => {
    const service = new MailService();
    await expect(service.sendVerificationEmail(markers[0], markers[5], '<Synthetic>')).rejects.toThrow(/^Mail delivery failed$/);
    await expect(service.sendResendVerificationEmail(markers[0], markers[5], '<Synthetic>')).rejects.toThrow(/^Mail delivery failed$/);
    expect(sendMail).not.toHaveBeenCalled();
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(nodemailer.createTestAccount).not.toHaveBeenCalled();
    expect(spies[0]).toHaveBeenCalledWith('Mail delivery attempt (verification)');
    expect(spies[0]).toHaveBeenCalledWith('Mail delivery attempt (resend-verification)');
    expect(spies[1]).toHaveBeenCalledWith('Mail delivery failed (verification)');
    expect(spies[1]).toHaveBeenCalledWith('Mail delivery failed (resend-verification)');
    expect(spies[0].mock.calls.some(c => String(c[0]).startsWith('Mail delivery completed'))).toBe(false);
  });
  it.each(['ethereal', 'smtp-development', 'smtp-production'])('%s logs safe delivery events and preserves mail content', async mode => {
    if (mode.startsWith('smtp')) { process.env.SMTP_HOST = 'synthetic-smtp.invalid'; process.env.SMTP_USER = markers[0]; process.env.SMTP_PASSWORD = markers[1]; }
    if (mode === 'smtp-production') process.env.NODE_ENV = 'production';
    if (mode === 'ethereal') process.env.USE_ETHEREAL = 'true';
    const service = new MailService();
    await service.sendVerificationEmail(markers[0], markers[5], '<Synthetic>');
    await service.sendResendVerificationEmail(markers[0], markers[5], '<Synthetic>');
    expect(spies[0]).toHaveBeenCalledWith('Mail delivery attempt (verification)');
    expect(spies[0]).toHaveBeenCalledWith('Mail delivery attempt (resend-verification)');
    expect(spies[0].mock.calls.some(c => String(c[0]).startsWith('Mail delivery completed'))).toBe(true);
    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(sendMail.mock.calls[0][0]).toMatchObject({ to: markers[0] });
    expect(sendMail.mock.calls[0][0].html).toContain(markers[5]);
    expect(sendMail.mock.calls[0][0].html).toContain('&lt;Synthetic&gt;');
  });
  it.each(['development', 'production'])('%s sanitizes SMTP failures', async mode => {
    process.env.NODE_ENV = mode; process.env.SMTP_HOST = 'synthetic-smtp.invalid';
    sendMail.mockRejectedValue(new Error(markers.join(' ')));
    await expect(new MailService().sendVerificationEmail(markers[0], markers[5], 'Synthetic')).rejects.toThrow(/^Mail delivery failed$/);
    expect(spies[1]).toHaveBeenCalledWith('Mail delivery failed (verification)');
  });
  it('sanitizes Ethereal initialization failure and refuses undelivered fallback', async () => {
    process.env.USE_ETHEREAL = 'true';
    (nodemailer.createTestAccount as jest.Mock).mockRejectedValue(new Error(markers.join(' ')));
    const service = new MailService();
    await expect(service.sendVerificationEmail(markers[0], markers[5], 'Synthetic')).rejects.toThrow(/^Mail delivery failed$/);
    await expect(service.sendResendVerificationEmail(markers[0], markers[5], 'Synthetic')).rejects.toThrow(/^Mail delivery failed$/);
    expect(spies[1]).toHaveBeenCalledWith('Mail transport initialization failed');
    expect(spies[1]).toHaveBeenCalledWith('Mail delivery failed (verification)');
    expect(spies[1]).toHaveBeenCalledWith('Mail delivery failed (resend-verification)');
    expect(sendMail).not.toHaveBeenCalled();
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(spies[0].mock.calls.some(c => String(c[0]).startsWith('Mail delivery completed'))).toBe(false);
  });
  it('retains production missing SMTP refusal with safe diagnostics', async () => {
    process.env.NODE_ENV = 'production';
    await expect(new MailService().sendVerificationEmail(markers[0], markers[5], 'Synthetic')).rejects.toThrow(/^Mail delivery failed$/);
    expect(sendMail).not.toHaveBeenCalled();
    expect(spies[1]).toHaveBeenCalledWith('SMTP_HOST is not configured in production');
  });
});
