import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma';

const router = Router();

const createSchema = z.object({
  productId:       z.number().int().positive(),
  locationId:      z.number().int().positive(),
  countedQuantity: z.number().int().min(0, 'Counted quantity cannot be negative'),
  reason:          z.string().optional(),
});

// GET /adjustments
router.get('/', async (_req: Request, res: Response) => {
  const adjustments = await prisma.adjustment.findMany({
    include: {
      product:  { select: { id: true, sku: true, name: true } },
      location: { select: { id: true, name: true, warehouse: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(adjustments);
});

// POST /adjustments
router.post('/', async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }

  const { productId, locationId, countedQuantity, reason } = parsed.data;

  // Look up current stock (may not exist yet)
  const stockItem = await prisma.stockItem.findUnique({
    where: { productId_locationId: { productId, locationId } },
  });
  const previousQuantity = stockItem?.quantity ?? 0;
  const difference = countedQuantity - previousQuantity;

  await prisma.$transaction(async (tx: typeof prisma) => {
    // Upsert the StockItem to the counted value
    await tx.stockItem.upsert({
      where: { productId_locationId: { productId, locationId } },
      create: { productId, locationId, quantity: countedQuantity },
      update: { quantity: countedQuantity },
    });

    // Log a StockMove with the net difference
    if (difference !== 0) {
      await tx.stockMove.create({
        data: {
          productId,
          ...(difference > 0
            ? { toLocation: locationId }
            : { fromLocation: locationId }),
          quantity: Math.abs(difference),
          reason: reason ? `Adjustment: ${reason}` : 'Stock adjustment',
        },
      });
    }

    // Record the adjustment audit entry
    await tx.adjustment.create({
      data: { productId, locationId, previousQuantity, countedQuantity, difference, reason },
    });
  });

  const adjustment = await prisma.adjustment.findFirst({
    where: { productId, locationId },
    orderBy: { createdAt: 'desc' },
    include: {
      product:  { select: { id: true, sku: true, name: true } },
      location: { select: { id: true, name: true, warehouse: { select: { name: true } } } },
    },
  });

  res.status(201).json(adjustment);
});

export default router;
