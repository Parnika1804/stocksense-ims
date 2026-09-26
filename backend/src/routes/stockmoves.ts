import { Router, Request, Response } from 'express';
import prisma from '../prisma';

const router = Router();

// GET /stockmoves
router.get('/', async (req: Request, res: Response) => {
  const productId = req.query.productId ? Number(req.query.productId) : undefined;
  const locationId = req.query.locationId ? Number(req.query.locationId) : undefined;

  const stockMoves = await prisma.stockMove.findMany({
    where: {
      ...(productId ? { productId } : {}),
      ...(locationId ? {
        OR: [{ fromLocation: locationId }, { toLocation: locationId }],
      } : {}),
    },
    include: {
      product: { select: { id: true, sku: true, name: true } },
      from: { select: { id: true, name: true } },
      to: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(stockMoves);
});

export default router;
