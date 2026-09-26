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

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRouter);
app.use('/products', productsRouter);
app.use('/warehouses', warehousesRouter);
app.use('/locations', locationsRouter);
app.use('/receipts', receiptsRouter);
app.use('/deliveries', deliveriesRouter);
app.use('/stockmoves', stockmovesRouter);
app.use('/adjustments', adjustmentsRouter);
app.use('/transfers', transfersRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
