import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma';

const router = Router();

const deliveryLineSchema = z.object({
  productId: z.number().int().positive(),
  qty: z.number().int().positive(),
});

const createDeliverySchema = z.object({
  reference: z.string().min(1),
  customerId: z.string().optional(),
  createdById: z.number().int().positive(),
  lines: z.array(deliveryLineSchema).min(1),
});

const validateDeliverySchema = z.object({
  lines: z.array(
    z.object({
      id: z.number().int().positive(),
      locationId: z.number().int().positive(),
    })
  ).min(1),
});

// GET /deliveries
router.get('/', async (_req: Request, res: Response) => {
  const deliveries = await prisma.delivery.findMany({
    include: {
      createdBy: { select: { id: true, name: true } },
      deliveryLines: { include: { product: { select: { id: true, sku: true, name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(deliveries);
});

// GET /deliveries/:id
router.get('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      deliveryLines: { include: { product: { select: { id: true, sku: true, name: true } } } },
    },
  });
  if (!delivery) { res.status(404).json({ error: 'Delivery not found' }); return; }
  res.json(delivery);
});

// POST /deliveries — create draft
router.post('/', async (req: Request, res: Response) => {
  const parsed = createDeliverySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }

  const { reference, customerId, createdById, lines } = parsed.data;

  const existing = await prisma.delivery.findUnique({ where: { reference } });
  if (existing) { res.status(409).json({ error: 'Reference already exists' }); return; }

  const delivery = await prisma.delivery.create({
    data: {
      reference,
      customerId,
      createdById,
      status: 'draft',
      deliveryLines: { create: lines },
    },
    include: { deliveryLines: true },
  });
  res.status(201).json(delivery);
});

// POST /deliveries/:id/validate — check stock, decrement, create moves
router.post('/:id/validate', async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  const parsed = validateDeliverySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }

  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: { deliveryLines: true },
  });
  if (!delivery) { res.status(404).json({ error: 'Delivery not found' }); return; }
  if (delivery.status !== 'draft') { res.status(409).json({ error: 'Delivery already validated' }); return; }

  const { lines } = parsed.data;

  // verify all line ids belong to this delivery
  const deliveryLineIds = new Set(delivery.deliveryLines.map((l: { id: number }) => l.id));
  for (const l of lines) {
    if (!deliveryLineIds.has(l.id)) {
      res.status(400).json({ error: `Line ${l.id} does not belong to this delivery` });
      return;
    }
  }

  // stock check before transaction
  const insufficientLines: { productId: number; locationId: number; required: number; available: number }[] = [];

  for (const line of lines) {
    const deliveryLine = delivery.deliveryLines.find((l: { id: number }) => l.id === line.id)!;
    const stockItem = await prisma.stockItem.findUnique({
      where: { productId_locationId: { productId: deliveryLine.productId, locationId: line.locationId } },
    });
    const available = stockItem?.quantity ?? 0;
    if (available < deliveryLine.qty) {
      insufficientLines.push({
        productId: deliveryLine.productId,
        locationId: line.locationId,
        required: deliveryLine.qty,
        available,
      });
    }
  }

  if (insufficientLines.length > 0) {
    res.status(422).json({ error: 'Insufficient stock', insufficientLines });
    return;
  }

  await prisma.$transaction(async (tx: typeof prisma) => {
    for (const line of lines) {
      const deliveryLine = delivery.deliveryLines.find((l: { id: number }) => l.id === line.id)!;

      await tx.stockItem.update({
        where: { productId_locationId: { productId: deliveryLine.productId, locationId: line.locationId } },
        data: { quantity: { decrement: deliveryLine.qty } },
      });

      await tx.stockMove.create({
        data: {
          productId: deliveryLine.productId,
          fromLocation: line.locationId,
          quantity: deliveryLine.qty,
          reason: `Delivery #${delivery.reference}`,
        },
      });
    }

    await tx.delivery.update({
      where: { id },
      data: { status: 'done', shippedAt: new Date() },
    });
  });

  const updated = await prisma.delivery.findUnique({
    where: { id },
    include: { deliveryLines: true },
  });
  res.json(updated);
});

export default router;
