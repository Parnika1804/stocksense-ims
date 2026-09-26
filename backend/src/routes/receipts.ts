import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma';

const router = Router();

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
  // per-line received quantities; keyed by receiptLineId
  lines: z.array(
    z.object({
      id: z.number().int().positive(),
      receivedQty: z.number().int().min(0),
      locationId: z.number().int().positive(),
    })
  ).min(1),
});

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

// POST /receipts — create draft
router.post('/', async (req: Request, res: Response) => {
  const parsed = createReceiptSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }

  const { reference, supplierId, createdById, lines } = parsed.data;

  const existing = await prisma.receipt.findUnique({ where: { reference } });
  if (existing) { res.status(409).json({ error: 'Reference already exists' }); return; }

  const receipt = await prisma.receipt.create({
    data: {
      reference,
      supplierId,
      createdById,
      status: 'draft',
      receiptLines: { create: lines },
    },
    include: { receiptLines: true },
  });
  res.status(201).json(receipt);
});

// POST /receipts/:id/validate — set done, update stock, create moves
router.post('/:id/validate', async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  const parsed = validateReceiptSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: { receiptLines: true },
  });
  if (!receipt) { res.status(404).json({ error: 'Receipt not found' }); return; }
  if (receipt.status !== 'draft') { res.status(409).json({ error: 'Receipt already validated' }); return; }

  const { lines } = parsed.data;

  // verify all line ids belong to this receipt
  const receiptLineIds = new Set(receipt.receiptLines.map((l: { id: number }) => l.id));
  for (const l of lines) {
    if (!receiptLineIds.has(l.id)) {
      res.status(400).json({ error: `Line ${l.id} does not belong to this receipt` });
      return;
    }
  }

  await prisma.$transaction(async (tx: typeof prisma) => {
    for (const line of lines) {
      const receiptLine = receipt.receiptLines.find((l: { id: number }) => l.id === line.id)!;

      if (line.receivedQty <= 0) continue;

      // upsert StockItem
      await tx.stockItem.upsert({
        where: { productId_locationId: { productId: receiptLine.productId, locationId: line.locationId } },
        create: { productId: receiptLine.productId, locationId: line.locationId, quantity: line.receivedQty },
        update: { quantity: { increment: line.receivedQty } },
      });

      // record StockMove (no fromLocation — goods arriving)
      await tx.stockMove.create({
        data: {
          productId: receiptLine.productId,
          toLocation: line.locationId,
          quantity: line.receivedQty,
          reason: `Receipt #${receipt.reference}`,
        },
      });

      // update line receivedQty
      await tx.receiptLine.update({
        where: { id: line.id },
        data: { receivedQty: line.receivedQty },
      });
    }

    // mark receipt done
    await tx.receipt.update({
      where: { id },
      data: { status: 'done', receivedAt: new Date() },
    });
  });

  const updated = await prisma.receipt.findUnique({
    where: { id },
    include: { receiptLines: true },
  });
  res.json(updated);
});

export default router;
