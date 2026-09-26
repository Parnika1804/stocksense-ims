import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma';

const router = Router();

const STATUSES = ['draft', 'waiting', 'ready', 'done', 'canceled'] as const;
type Status = typeof STATUSES[number];

const receiptLineSchema = z.object({
  productId: z.number().int().positive(),
  expectedQty: z.number().int().positive(),
  receivedQty: z.number().int().min(0).default(0),
});

const createReceiptSchema = z.object({
  reference: z.string().min(1),
  supplierId: z.string().optional(),
  createdById: z.number().int().positive(),
  lines: z.array(receiptLineSchema).min(1),
});

const validateReceiptSchema = z.object({
  lines: z.array(z.object({
    id: z.number().int().positive(),
    receivedQty: z.number().int().min(0),
    locationId: z.number().int().positive(),
  })).min(1),
});

const statusSchema = z.object({
  status: z.enum(STATUSES),
  // required when transitioning to done via status endpoint
  lines: z.array(z.object({
    id: z.number().int().positive(),
    receivedQty: z.number().int().min(0),
    locationId: z.number().int().positive(),
  })).optional(),
});

// ── shared stock mutation for "done" ──────────────────────────────
async function applyReceiptDone(
  id: number,
  receiptLines: { id: number; productId: number; expectedQty: number; receivedQty: number }[],
  lines: { id: number; receivedQty: number; locationId: number }[],
  reference: string,
) {
  const lineIds = new Set(receiptLines.map((l) => l.id));
  for (const l of lines) {
    if (!lineIds.has(l.id)) throw new Error(`Line ${l.id} does not belong to this receipt`);
  }

  await prisma.$transaction(async (tx) => {
    for (const line of lines) {
      const rl = receiptLines.find((l) => l.id === line.id)!;
      if (line.receivedQty <= 0) continue;
      await tx.stockItem.upsert({
        where: { productId_locationId: { productId: rl.productId, locationId: line.locationId } },
        create: { productId: rl.productId, locationId: line.locationId, quantity: line.receivedQty },
        update: { quantity: { increment: line.receivedQty } },
      });
      await tx.stockMove.create({
        data: { productId: rl.productId, toLocation: line.locationId, quantity: line.receivedQty, reason: `Receipt #${reference}` },
      });
      await tx.receiptLine.update({ where: { id: line.id }, data: { receivedQty: line.receivedQty } });
    }
    await tx.receipt.update({ where: { id }, data: { status: 'done', receivedAt: new Date() } });
  });
}

// GET /receipts
router.get('/', async (_req: Request, res: Response) => {
  const receipts = await prisma.receipt.findMany({
    include: {
      createdBy: { select: { id: true, name: true } },
      receiptLines: { include: { product: { select: { id: true, sku: true, name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(receipts);
});

// GET /receipts/:id
router.get('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      receiptLines: { include: { product: { select: { id: true, sku: true, name: true } } } },
    },
  });
  if (!receipt) { res.status(404).json({ error: 'Receipt not found' }); return; }
  res.json(receipt);
});

// POST /receipts
router.post('/', async (req: Request, res: Response) => {
  const parsed = createReceiptSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }

  const { reference, supplierId, createdById, lines } = parsed.data;
  const existing = await prisma.receipt.findUnique({ where: { reference } });
  if (existing) { res.status(409).json({ error: 'Reference already exists' }); return; }

  const receipt = await prisma.receipt.create({
    data: { reference, supplierId, createdById, status: 'draft', receiptLines: { create: lines } },
    include: { receiptLines: true },
  });
  res.status(201).json(receipt);
});

// POST /receipts/:id/status — transition to any status
router.post('/:id/status', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }

  const receipt = await prisma.receipt.findUnique({ where: { id }, include: { receiptLines: true } });
  if (!receipt) { res.status(404).json({ error: 'Receipt not found' }); return; }

  const { status, lines } = parsed.data;

  // Block going back to draft from done
  if (receipt.status === 'done' && status === 'draft') {
    res.status(409).json({ error: 'Cannot revert a completed receipt to draft' }); return;
  }
  // Already in target status — idempotent
  if (receipt.status === status) { res.json(receipt); return; }

  if (status === 'done') {
    if (!lines?.length) { res.status(400).json({ error: 'lines required when transitioning to done' }); return; }
    try {
      await applyReceiptDone(id, receipt.receiptLines as never, lines, receipt.reference);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message }); return;
    }
  } else {
    await prisma.receipt.update({ where: { id }, data: { status } });
  }

  const updated = await prisma.receipt.findUnique({
    where: { id },
    include: { createdBy: { select: { id: true, name: true } }, receiptLines: { include: { product: { select: { id: true, sku: true, name: true } } } } },
  });
  res.json(updated);
});

// POST /receipts/:id/validate — shortcut to done (kept for backward compat)
router.post('/:id/validate', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const parsed = validateReceiptSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }

  const receipt = await prisma.receipt.findUnique({ where: { id }, include: { receiptLines: true } });
  if (!receipt) { res.status(404).json({ error: 'Receipt not found' }); return; }
  if (receipt.status === 'done') { res.status(409).json({ error: 'Receipt already validated' }); return; }

  try {
    await applyReceiptDone(id, receipt.receiptLines as never, parsed.data.lines, receipt.reference);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message }); return;
  }

  const updated = await prisma.receipt.findUnique({ where: { id }, include: { receiptLines: true } });
  res.json(updated);
});

export default router;
