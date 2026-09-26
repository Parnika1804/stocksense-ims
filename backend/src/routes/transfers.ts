import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma';

const router = Router();

const createSchema = z.object({
  productId:      z.number().int().positive(),
  fromLocationId: z.number().int().positive(),
  toLocationId:   z.number().int().positive(),
  quantity:       z.number().int().min(1, 'Quantity must be at least 1'),
  reason:         z.string().optional(),
}).refine((d) => d.fromLocationId !== d.toLocationId, {
  message: 'Source and destination locations must be different',
  path: ['toLocationId'],
});

// GET /transfers
router.get('/', async (_req: Request, res: Response) => {
  const transfers = await prisma.transfer.findMany({
    include: {
      product:      { select: { id: true, sku: true, name: true } },
      fromLocation: { select: { id: true, name: true, warehouse: { select: { name: true } } } },
      toLocation:   { select: { id: true, name: true, warehouse: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(transfers);
});

// POST /transfers
router.post('/', async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }

  const { productId, fromLocationId, toLocationId, quantity, reason } = parsed.data;

  // Check source stock before opening a transaction
  const sourceItem = await prisma.stockItem.findUnique({
    where: { productId_locationId: { productId, locationId: fromLocationId } },
  });
  const available = sourceItem?.quantity ?? 0;

  if (available < quantity) {
    res.status(422).json({
      error: 'Insufficient stock at source location',
      available,
      required: quantity,
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Decrement source
    await tx.stockItem.update({
      where: { productId_locationId: { productId, locationId: fromLocationId } },
      data: { quantity: { decrement: quantity } },
    });

    // Upsert destination
    await tx.stockItem.upsert({
      where: { productId_locationId: { productId, locationId: toLocationId } },
      create: { productId, locationId: toLocationId, quantity },
      update: { quantity: { increment: quantity } },
    });

    // Log a single StockMove with both locations set
    await tx.stockMove.create({
      data: {
        productId,
        fromLocation: fromLocationId,
        toLocation:   toLocationId,
        quantity,
        reason: reason ? `Transfer: ${reason}` : 'Internal transfer',
      },
    });

    // Record the transfer
    await tx.transfer.create({
      data: { productId, fromLocationId, toLocationId, quantity, reason },
    });
  });

  const transfer = await prisma.transfer.findFirst({
    where: { productId, fromLocationId, toLocationId },
    orderBy: { createdAt: 'desc' },
    include: {
      product:      { select: { id: true, sku: true, name: true } },
      fromLocation: { select: { id: true, name: true, warehouse: { select: { name: true } } } },
      toLocation:   { select: { id: true, name: true, warehouse: { select: { name: true } } } },
    },
  });

  res.status(201).json(transfer);
});

export default router;
