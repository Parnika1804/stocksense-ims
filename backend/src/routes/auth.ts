import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../prisma';

const router = Router();

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const signupSchema = authSchema.extend({
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['manager', 'staff']).default('staff'),
});

const forgotSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

function signToken(userId: number, role: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return jwt.sign({ sub: userId, role }, secret, { expiresIn: '7d' });
}

// POST /auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }

  const { email, password, name, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'Email already in use' });
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, name, password: hashed, role },
    select: { id: true, email: true, name: true, role: true },
  });

  const token = signToken(user.id, user.role);
  res.status(201).json({ token, user });
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signToken(user.id, user.role);
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

// POST /auth/forgot-password — generate OTP, store hashed, return raw OTP (demo mode)
router.post('/forgot-password', async (req: Request, res: Response) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Always respond the same to prevent email enumeration
  if (!user) {
    res.json({ message: 'If that email exists, an OTP has been generated.', otp: null });
    return;
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
  const otpHash = await bcrypt.hash(otp, 10);
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await prisma.user.update({
    where: { id: user.id },
    data: { otpHash, otpExpiry },
  });

  // Demo mode: return OTP directly
  res.json({ message: 'OTP generated (demo mode — no email sent).', otp });
});

// POST /auth/reset-password — validate OTP, update password
router.post('/reset-password', async (req: Request, res: Response) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }

  const { email, otp, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.otpHash || !user.otpExpiry) {
    res.status(400).json({ error: 'Invalid or expired OTP' });
    return;
  }

  if (new Date() > user.otpExpiry) {
    res.status(400).json({ error: 'OTP has expired' });
    return;
  }

  const valid = await bcrypt.compare(otp, user.otpHash);
  if (!valid) {
    res.status(400).json({ error: 'Invalid OTP' });
    return;
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed, otpHash: null, otpExpiry: null },
  });

  res.json({ message: 'Password updated successfully.' });
});

export default router;
