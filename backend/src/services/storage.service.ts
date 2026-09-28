import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

export class StorageService {
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(config.storagePath);
    this.ensureDirectories();
  }

  private ensureDirectories() {
    const folders = ['templates', 'contracts', 'quotations'];
    folders.forEach((folder) => {
      const dirPath = path.join(this.baseDir, folder);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });
  }

  public getFilePath(category: 'templates' | 'contracts' | 'quotations', fileName: string): string {
    return path.join(this.baseDir, category, fileName);
  }

  public async saveFile(category: 'templates' | 'contracts' | 'quotations', fileName: string, content: Buffer | string): Promise<string> {
    const filePath = this.getFilePath(category, fileName);
    await fs.promises.writeFile(filePath, content);
    return filePath;
  }
}
