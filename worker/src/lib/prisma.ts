import { PrismaClient } from '@prisma/client';
import { config } from '../config';

// Nel worker non serve il singleton pattern: ogni processo è single-threaded
export const prisma = new PrismaClient({
  log: config.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
