import fs from "fs/promises";
import path from "path";
import { ObjectStore } from ".";

const baseDir = path.resolve(process.cwd(), "storage");

async function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

const LocalStore: ObjectStore = {
  async put(key, data) {
    const filePath = path.join(baseDir, key);
    await ensureDir(filePath);
    if (Buffer.isBuffer(data)) {
      await fs.writeFile(filePath, data);
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of data) chunks.push(Buffer.from(chunk));
      await fs.writeFile(filePath, Buffer.concat(chunks));
    }
  },

  async get(key) {
    try {
      const filePath = path.join(baseDir, key);
      return await fs.readFile(filePath);
    } catch {
      return null;
    }
  },

  async remove(key) {
    await fs.rm(path.join(baseDir, key), { force: true });
  },

  async list(prefix = "") {
    const dir = path.join(baseDir, prefix);
    try {
      const files = await fs.readdir(dir);
      return files.map((f) => path.join(prefix, f));
    } catch {
      return [];
    }
  },
};

export default LocalStore;
