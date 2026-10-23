import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { api } from './routes.js';
import { seedIfEmpty } from './seed.js';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(rootDir, '.env') });

async function connectDb() {
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    return;
  }
  console.log('No MONGODB_URI set. Starting an ephemeral MongoDB with sample books.');
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const memory = await MongoMemoryServer.create();
  await mongoose.connect(memory.getUri('ledgerloop'));
}

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', api);

const clientDist = path.join(rootDir, 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'), (error) => {
      if (error) next(error);
    });
  });
}

const port = Number(process.env.PORT) || 4000;
await connectDb();
const seeded = await seedIfEmpty();
if (seeded) console.log('Loaded Nila Studio sample books');
app.listen(port, '0.0.0.0', () => {
  console.log(`LedgerLoop listening on ${port}`);
});
