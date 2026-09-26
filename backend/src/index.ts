import 'dotenv/config';
import express from 'express';
import authRouter from './routes/auth';
import productsRouter from './routes/products';
import warehousesRouter from './routes/warehouses';
import locationsRouter from './routes/locations';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRouter);
app.use('/products', productsRouter);
app.use('/warehouses', warehousesRouter);
app.use('/locations', locationsRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
