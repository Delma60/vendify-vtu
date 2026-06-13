/**
 * Nodemailer mail client
 * Configured via SMTP env vars (Zoho / Mailgun / Postmark compatible)
 */

import nodemailer from 'nodemailer';

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (_transporter) return _transporter;

  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return _transporter;
}

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail(options: MailOptions): Promise<void> {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? '"VendPro" <noreply@vendpro.ng>',
    ...options,
  });
}

// ─── Pre-built email templates ────────────────────────────────────────────────

export async function sendEmailVerification(to: string, otp: string, name: string): Promise<void> {
  await sendMail({
    to,
    subject: 'Verify your email address',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Hi ${name},</h2>
        <p>Use the code below to verify your email address. It expires in 15 minutes.</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;padding:24px;background:#f4f4f5;border-radius:8px;text-align:center">
          ${otp}
        </div>
        <p style="color:#6b7280;font-size:13px">If you didn't create an account, you can safely ignore this email.</p>
      </div>
    `,
    text: `Your email verification code is: ${otp}. It expires in 15 minutes.`,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string, name: string): Promise<void> {
  await sendMail({
    to,
    subject: 'Reset your password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Hi ${name},</h2>
        <p>We received a request to reset your password. Click the button below (valid for 15 minutes).</p>
        <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:6px;margin:16px 0">
          Reset Password
        </a>
        <p style="color:#6b7280;font-size:13px">If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `,
    text: `Reset your password here: ${resetUrl}`,
  });
}

export async function send2FAOtpEmail(to: string, otp: string, name: string): Promise<void> {
  await sendMail({
    to,
    subject: 'Your login verification code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Hi ${name},</h2>
        <p>Enter this code to complete your login. It expires in 15 minutes.</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;padding:24px;background:#f4f4f5;border-radius:8px;text-align:center">
          ${otp}
        </div>
        <p style="color:#6b7280;font-size:13px">Never share this code with anyone.</p>
      </div>
    `,
    text: `Your 2FA login code is: ${otp}. It expires in 15 minutes.`,
  });
}

export async function sendNewDeviceAlertEmail(
  to: string,
  name: string,
  details: { ip: string; userAgent: string; time: string }
): Promise<void> {
  await sendMail({
    to,
    subject: '⚠️ New device login detected',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Security Alert</h2>
        <p>Hi ${name}, we detected a login to your account from a new device.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:8px;color:#6b7280">Time</td><td style="padding:8px">${details.time}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">IP Address</td><td style="padding:8px">${details.ip}</td></tr>
          <tr><td style="padding:8px;color:#6b7280">Device</td><td style="padding:8px">${details.userAgent}</td></tr>
        </table>
        <p style="margin-top:20px">If this wasn't you, <strong>change your password immediately</strong> and contact support.</p>
      </div>
    `,
    text: `New device login: IP ${details.ip} at ${details.time}. If this wasn't you, change your password immediately.`,
  });
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  await sendMail({
    to,
    subject: `Welcome to VendPro, ${name}!`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Welcome, ${name}! 🎉</h2>
        <p>Your account is ready. Fund your wallet to start buying airtime, data, and paying bills instantly.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display:inline-block;padding:12px 24px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:6px;margin:16px 0">
          Go to Dashboard
        </a>
      </div>
    `,
    text: `Welcome to VendPro! Visit your dashboard: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  });
}