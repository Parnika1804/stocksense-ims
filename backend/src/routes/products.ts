import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma';

const router = Router();

const productSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1).default('General'),
  description: z.string().optional(),
  unit: z.string().default('pcs'),
  reorderQty: z.number().int().min(0).default(0),
  reorderThreshold: z.number().int().min(0).nullable().optional(),
});

// GET /products
router.get('/', async (_req: Request, res: Response) => {
  const products = await prisma.product.findMany({ orderBy: { name: 'asc' } });
  res.json(products);
});

// GET /products/stock  — stock per product per location
router.get('/stock', async (_req: Request, res: Response) => {
  const stock = await prisma.stockItem.findMany({
    include: {
      product: { select: { id: true, sku: true, name: true, unit: true, category: true, reorderThreshold: true } },
      location: {
        select: {
          id: true,
          name: true,
          aisle: true,
          bay: true,
          level: true,
          warehouse: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ product: { name: 'asc' } }, { location: { name: 'asc' } }],
  });
  res.json(stock);
});

// GET /products/:id
router.get('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) { res.status(404).json({ error: 'Product not found' }); return; }
  res.json(product);
});

// POST /products
router.post('/', async (req: Request, res: Response) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }

  const existing = await prisma.product.findUnique({ where: { sku: parsed.data.sku } });
  if (existing) { res.status(409).json({ error: 'SKU already exists' }); return; }

  const product = await prisma.product.create({ data: parsed.data });
  res.status(201).json(product);
});

// PUT /products/:id
router.put('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }

  const product = await prisma.product.update({ where: { id }, data: parsed.data }).catch(() => null);
  if (!product) { res.status(404).json({ error: 'Product not found' }); return; }
  res.json(product);
});

// DELETE /products/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await prisma.product.delete({ where: { id } }).catch(() => null);
  res.status(204).send();
});

export default router;
