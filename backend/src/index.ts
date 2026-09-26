import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import productsRouter from './routes/products';
import warehousesRouter from './routes/warehouses';
import locationsRouter from './routes/locations';
import receiptsRouter from './routes/receipts';
import deliveriesRouter from './routes/deliveries';
import stockmovesRouter from './routes/stockmoves';
import adjustmentsRouter from './routes/adjustments';
import transfersRouter from './routes/transfers';
import { requireAuth } from './middleware/requireAuth';
import { requireRole } from './middleware/requireRole';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });

// ── Public auth routes (no JWT required) ─────────────────────────
app.use('/auth', authRouter);

// ── All routes below require a valid JWT ─────────────────────────
app.use(requireAuth);

// ── Products: GET open; POST/PUT/DELETE manager only ─────────────
app.get('/products',       productsRouter);
app.get('/products/stock', productsRouter);
app.get('/products/:id',   productsRouter);
app.post(  '/products',     requireRole('manager'), productsRouter);
app.put(   '/products/:id', requireRole('manager'), productsRouter);
app.delete('/products/:id', requireRole('manager'), productsRouter);

// ── Warehouses: GET open; mutations manager only ──────────────────
app.get('/warehouses',       warehousesRouter);
app.get('/warehouses/:id',   warehousesRouter);
app.post(  '/warehouses',     requireRole('manager'), warehousesRouter);
app.put(   '/warehouses/:id', requireRole('manager'), warehousesRouter);
app.delete('/warehouses/:id', requireRole('manager'), warehousesRouter);

// ── Locations: GET open; mutations manager only ───────────────────
app.get('/locations',       locationsRouter);
app.get('/locations/:id',   locationsRouter);
app.post(  '/locations',     requireRole('manager'), locationsRouter);
app.put(   '/locations/:id', requireRole('manager'), locationsRouter);
app.delete('/locations/:id', requireRole('manager'), locationsRouter);

// ── Receipts ──────────────────────────────────────────────────────
app.get('/receipts',                    receiptsRouter);
app.get('/receipts/:id',                receiptsRouter);
app.post('/receipts',                   requireRole('manager'),         receiptsRouter);
app.post('/receipts/:id/validate',      requireRole('manager', 'staff'), receiptsRouter);
app.post('/receipts/:id/status',        requireRole('manager', 'staff'), receiptsRouter);

// ── Deliveries ────────────────────────────────────────────────────
app.get('/deliveries',                  deliveriesRouter);
app.get('/deliveries/:id',              deliveriesRouter);
app.post('/deliveries',                 requireRole('manager'),         deliveriesRouter);
app.post('/deliveries/:id/validate',    requireRole('manager', 'staff'), deliveriesRouter);
app.post('/deliveries/:id/status',      requireRole('manager', 'staff'), deliveriesRouter);

// ── Stock Moves: GET only ─────────────────────────────────────────
app.use('/stockmoves', stockmovesRouter);

// ── Adjustments: both roles ───────────────────────────────────────
app.get('/adjustments',  adjustmentsRouter);
app.post('/adjustments', requireRole('manager', 'staff'), adjustmentsRouter);

// ── Transfers ─────────────────────────────────────────────────────
app.get('/transfers',            transfersRouter);
app.post('/transfers',           requireRole('manager', 'staff'), transfersRouter);
app.post('/transfers/:id/status',requireRole('manager', 'staff'), transfersRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
