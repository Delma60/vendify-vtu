import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  displayName: z.string().min(2, 'Name must be at least 2 characters').max(60),
  phone: z
    .string()
    .regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number'),
  referralCode: z.string().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

export const VerifyEmailSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/, 'OTP must be numeric'),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[0-9]/),
});

export const Setup2FASchema = z.object({
  method: z.enum(['email_otp', 'totp']),
});

export const Verify2FASchema = z.object({
  code: z
    .string()
    .min(6, 'Code must be at least 6 characters')
    .max(12), // backup codes are longer
  isBackupCode: z.boolean().optional().default(false),
});

export const Disable2FASchema = z.object({
  password: z.string().min(1),
});