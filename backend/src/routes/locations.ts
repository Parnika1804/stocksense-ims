import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma';

const router = Router();

const locationSchema = z.object({
  name: z.string().min(1),
  warehouseId: z.number().int().positive(),
  aisle: z.string().optional(),
  bay: z.string().optional(),
  level: z.string().optional(),
});

// GET /locations
router.get('/', async (req: Request, res: Response) => {
  const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
  const locations = await prisma.location.findMany({
    where: warehouseId ? { warehouseId } : undefined,
    include: { warehouse: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(locations);
});

// GET /locations/:id
router.get('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const location = await prisma.location.findUnique({
    where: { id },
    include: { warehouse: { select: { id: true, name: true } } },
  });
  if (!location) { res.status(404).json({ error: 'Location not found' }); return; }
  res.json(location);
});

// POST /locations
router.post('/', async (req: Request, res: Response) => {
  const parsed = locationSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }

  const warehouse = await prisma.warehouse.findUnique({ where: { id: parsed.data.warehouseId } });
  if (!warehouse) { res.status(400).json({ error: 'Warehouse not found' }); return; }

  const location = await prisma.location.create({ data: parsed.data });
  res.status(201).json(location);
});

// PUT /locations/:id
router.put('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const parsed = locationSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }

  if (parsed.data.warehouseId) {
    const warehouse = await prisma.warehouse.findUnique({ where: { id: parsed.data.warehouseId } });
    if (!warehouse) { res.status(400).json({ error: 'Warehouse not found' }); return; }
  }

  const location = await prisma.location.update({ where: { id }, data: parsed.data }).catch(() => null);
  if (!location) { res.status(404).json({ error: 'Location not found' }); return; }
  res.json(location);
});

// DELETE /locations/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await prisma.location.delete({ where: { id } }).catch(() => null);
  res.status(204).send();
});

export default router;
