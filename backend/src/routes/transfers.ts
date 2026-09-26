import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma';

const router = Router();

const STATUSES = ['draft', 'waiting', 'ready', 'done', 'canceled'] as const;

const createSchema = z.object({
  productId:      z.number().int().positive(),
  fromLocationId: z.number().int().positive(),
  toLocationId:   z.number().int().positive(),
  quantity:       z.number().int().min(1),
  reason:         z.string().optional(),
}).refine((d) => d.fromLocationId !== d.toLocationId, {
  message: 'Source and destination locations must be different',
  path: ['toLocationId'],
});

const statusSchema = z.object({ status: z.enum(STATUSES) });

const include = {
  product:      { select: { id: true, sku: true, name: true } },
  fromLocation: { select: { id: true, name: true, warehouse: { select: { name: true } } } },
  toLocation:   { select: { id: true, name: true, warehouse: { select: { name: true } } } },
} as const;

// GET /transfers
router.get('/', async (_req: Request, res: Response) => {
  const transfers = await prisma.transfer.findMany({ include, orderBy: { createdAt: 'desc' } });
  res.json(transfers);
});

// POST /transfers — creates as draft, immediately executes stock move (done)
router.post('/', async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }

  const { productId, fromLocationId, toLocationId, quantity, reason } = parsed.data;

  const sourceItem = await prisma.stockItem.findUnique({
    where: { productId_locationId: { productId, locationId: fromLocationId } },
  });
  const available = sourceItem?.quantity ?? 0;
  if (available < quantity) {
    res.status(422).json({ error: 'Insufficient stock at source location', available, required: quantity }); return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.stockItem.update({
      where: { productId_locationId: { productId, locationId: fromLocationId } },
      data: { quantity: { decrement: quantity } },
    });
    await tx.stockItem.upsert({
      where: { productId_locationId: { productId, locationId: toLocationId } },
      create: { productId, locationId: toLocationId, quantity },
      update: { quantity: { increment: quantity } },
    });
    await tx.stockMove.create({
      data: { productId, fromLocation: fromLocationId, toLocation: toLocationId, quantity, reason: reason ? `Transfer: ${reason}` : 'Internal transfer' },
    });
    await tx.transfer.create({
      data: { productId, fromLocationId, toLocationId, quantity, reason, status: 'done' },
    });
  });

  const transfer = await prisma.transfer.findFirst({
    where: { productId, fromLocationId, toLocationId },
    orderBy: { createdAt: 'desc' },
    include,
  });
  res.status(201).json(transfer);
});

// POST /transfers/:id/status — transition (no stock side-effects except done→canceled is blocked)
router.post('/:id/status', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }

  const transfer = await prisma.transfer.findUnique({ where: { id } });
  if (!transfer) { res.status(404).json({ error: 'Transfer not found' }); return; }

  const { status } = parsed.data;

  if (transfer.status === 'done' && status === 'draft') {
    res.status(409).json({ error: 'Cannot revert a completed transfer to draft' }); return;
  }
  if (transfer.status === status) { res.json(transfer); return; }

  // Transfers execute stock immediately on POST /, so status here is metadata-only
  const updated = await prisma.transfer.update({ where: { id }, data: { status }, include });
  res.json(updated);
});

export default router;
