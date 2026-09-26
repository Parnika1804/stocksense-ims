import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma';

const router = Router();

const STATUSES = ['draft', 'waiting', 'ready', 'done', 'canceled'] as const;

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
  lines: z.array(z.object({
    id: z.number().int().positive(),
    locationId: z.number().int().positive(),
  })).min(1),
});

const statusSchema = z.object({
  status: z.enum(STATUSES),
  lines: z.array(z.object({
    id: z.number().int().positive(),
    locationId: z.number().int().positive(),
  })).optional(),
});

// ── shared stock mutation for "done" ──────────────────────────────
async function applyDeliveryDone(
  id: number,
  deliveryLines: { id: number; productId: number; qty: number }[],
  lines: { id: number; locationId: number }[],
  reference: string,
) {
  const lineIds = new Set(deliveryLines.map((l) => l.id));
  for (const l of lines) {
    if (!lineIds.has(l.id)) throw new Error(`Line ${l.id} does not belong to this delivery`);
  }

  // stock check
  const insufficient: { productId: number; locationId: number; required: number; available: number }[] = [];
  for (const line of lines) {
    const dl = deliveryLines.find((l) => l.id === line.id)!;
    const stockItem = await prisma.stockItem.findUnique({
      where: { productId_locationId: { productId: dl.productId, locationId: line.locationId } },
    });
    const available = stockItem?.quantity ?? 0;
    if (available < dl.qty) insufficient.push({ productId: dl.productId, locationId: line.locationId, required: dl.qty, available });
  }
  if (insufficient.length > 0) {
    const err = new Error('Insufficient stock') as Error & { insufficientLines: typeof insufficient };
    err.insufficientLines = insufficient;
    throw err;
  }

  await prisma.$transaction(async (tx) => {
    for (const line of lines) {
      const dl = deliveryLines.find((l) => l.id === line.id)!;
      await tx.stockItem.update({
        where: { productId_locationId: { productId: dl.productId, locationId: line.locationId } },
        data: { quantity: { decrement: dl.qty } },
      });
      await tx.stockMove.create({
        data: { productId: dl.productId, fromLocation: line.locationId, quantity: dl.qty, reason: `Delivery #${reference}` },
      });
    }
    await tx.delivery.update({ where: { id }, data: { status: 'done', shippedAt: new Date() } });
  });
}

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

// POST /deliveries
router.post('/', async (req: Request, res: Response) => {
  const parsed = createDeliverySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }

  const { reference, customerId, createdById, lines } = parsed.data;
  const existing = await prisma.delivery.findUnique({ where: { reference } });
  if (existing) { res.status(409).json({ error: 'Reference already exists' }); return; }

  const delivery = await prisma.delivery.create({
    data: { reference, customerId, createdById, status: 'draft', deliveryLines: { create: lines } },
    include: { deliveryLines: true },
  });
  res.status(201).json(delivery);
});

// POST /deliveries/:id/status
router.post('/:id/status', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }

  const delivery = await prisma.delivery.findUnique({ where: { id }, include: { deliveryLines: true } });
  if (!delivery) { res.status(404).json({ error: 'Delivery not found' }); return; }

  const { status, lines } = parsed.data;

  if (delivery.status === 'done' && status === 'draft') {
    res.status(409).json({ error: 'Cannot revert a completed delivery to draft' }); return;
  }
  if (delivery.status === status) { res.json(delivery); return; }

  if (status === 'done') {
    if (!lines?.length) { res.status(400).json({ error: 'lines required when transitioning to done' }); return; }
    try {
      await applyDeliveryDone(id, delivery.deliveryLines as never, lines, delivery.reference);
    } catch (e: unknown) {
      const err = e as Error & { insufficientLines?: unknown[] };
      if (err.insufficientLines) {
        res.status(422).json({ error: err.message, insufficientLines: err.insufficientLines }); return;
      }
      res.status(400).json({ error: err.message }); return;
    }
  } else {
    await prisma.delivery.update({ where: { id }, data: { status } });
  }

  const updated = await prisma.delivery.findUnique({
    where: { id },
    include: { createdBy: { select: { id: true, name: true } }, deliveryLines: { include: { product: { select: { id: true, sku: true, name: true } } } } },
  });
  res.json(updated);
});

// POST /deliveries/:id/validate — shortcut to done
router.post('/:id/validate', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const parsed = validateDeliverySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }

  const delivery = await prisma.delivery.findUnique({ where: { id }, include: { deliveryLines: true } });
  if (!delivery) { res.status(404).json({ error: 'Delivery not found' }); return; }
  if (delivery.status === 'done') { res.status(409).json({ error: 'Delivery already validated' }); return; }

  try {
    await applyDeliveryDone(id, delivery.deliveryLines as never, parsed.data.lines, delivery.reference);
  } catch (e: unknown) {
    const err = e as Error & { insufficientLines?: unknown[] };
    if (err.insufficientLines) {
      res.status(422).json({ error: err.message, insufficientLines: err.insufficientLines }); return;
    }
    res.status(400).json({ error: err.message }); return;
  }

  const updated = await prisma.delivery.findUnique({ where: { id }, include: { deliveryLines: true } });
  res.json(updated);
});

export default router;
