import 'dotenv/config';
import express from 'express';
import authRouter from './routes/auth';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
