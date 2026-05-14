import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';

async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const smtpHost = process.env.SMTP_HOST;

  if (!smtpHost) {
    // No SMTP configured — log to console as fallback
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    console.log(`[Password Reset] No SMTP_HOST configured. Reset link for ${to}: ${resetUrl}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  });

  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@aidocassistant.com',
    to,
    subject: 'Password Reset Request - AI Documentation Assistant',
    text: `You requested a password reset. Click the link below to reset your password (expires in 1 hour):\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your AI Documentation Assistant account.</p>
        <p>Click the button below to reset your password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;margin:16px 0;">
          Reset Password
        </a>
        <p style="color:#666;font-size:13px;">If you did not request this, please ignore this email. Your password will not change.</p>
      </div>
    `,
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const token = uuidv4();
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });

      try {
        await sendPasswordResetEmail(user.email, token);
      } catch (emailError) {
        // Log email failure but don't expose to client
        console.error('Failed to send password reset email:', emailError);
      }
    }

    // Always return success to prevent email enumeration
    res.status(200).json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
}
