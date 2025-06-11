import { Readable } from "stream";

export interface ObjectStore {
  put(key: string, data: Buffer | Readable, mimeType?: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}

export type StoreDriver = "s3" | "supabase" | "local";

export interface StoreOptions {
  driver: StoreDriver;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { driver } = (process.env.STORAGE_DRIVER ? { driver: process.env.STORAGE_DRIVER } : { driver: "local" }) as StoreOptions;

let store: ObjectStore;

switch (driver) {
  case "s3":
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    store = require("./s3").default;
    break;
  case "supabase":
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    store = require("./supabase").default;
    break;
  default:
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    store = require("./local").default;
}

export default store;
