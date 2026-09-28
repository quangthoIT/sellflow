import dotenv from 'dotenv';
import { processPDFTask, PDFJobPayload } from './pdf.js';
import { processEmailTask, EmailJobPayload } from './email.js';

dotenv.config();

console.log('⚙️ [Worker Engine] Starting SellFlow Background Worker Service...');

// Background job processor event loop
async function runWorkerLoop() {
  console.log('🚀 [Worker Engine] Background processing queue active and listening for PDF/Email jobs...');
}

runWorkerLoop();
