import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma';

const router = Router();

const warehouseSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
});

// GET /warehouses
router.get('/', async (_req: Request, res: Response) => {
  const warehouses = await prisma.warehouse.findMany({
    include: { locations: true },
    orderBy: { name: 'asc' },
  });
  res.json(warehouses);
});

// GET /warehouses/:id
router.get('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const warehouse = await prisma.warehouse.findUnique({
    where: { id },
    include: { locations: true },
  });
  if (!warehouse) { res.status(404).json({ error: 'Warehouse not found' }); return; }
  res.json(warehouse);
});

// POST /warehouses
router.post('/', async (req: Request, res: Response) => {
  const parsed = warehouseSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }

  const warehouse = await prisma.warehouse.create({ data: parsed.data });
  res.status(201).json(warehouse);
});

// PUT /warehouses/:id
router.put('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const parsed = warehouseSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }

  const warehouse = await prisma.warehouse.update({ where: { id }, data: parsed.data }).catch(() => null);
  if (!warehouse) { res.status(404).json({ error: 'Warehouse not found' }); return; }
  res.json(warehouse);
});

// DELETE /warehouses/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await prisma.warehouse.delete({ where: { id } }).catch(() => null);
  res.status(204).send();
});

export default router;
