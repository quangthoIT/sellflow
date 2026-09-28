import { PrismaClient } from '@prisma/client';

(BigInt.prototype as any).toJSON = function () {
  const num = Number(this);
  return Number.isSafeInteger(num) ? num : this.toString();
};

export const db = new PrismaClient();
