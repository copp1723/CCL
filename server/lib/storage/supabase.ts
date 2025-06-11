import { createClient } from "@supabase/supabase-js";
import { Readable } from "stream";
import { ObjectStore } from ".";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
const bucket = process.env.SUPABASE_BUCKET!;

const SupabaseStore: ObjectStore = {
  async put(key, data, mimeType) {
    await supabase.storage.from(bucket).upload(key, data as any, { contentType: mimeType, upsert: true });
  },
  async get(key) {
    const { data } = await supabase.storage.from(bucket).download(key);
    if (!data) return null;
    const chunks: Buffer[] = [];
    for await (const chunk of data as Readable) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  },
  async remove(key) {
    await supabase.storage.from(bucket).remove([key]);
  },
  async list(prefix = "") {
    const { data } = await supabase.storage.from(bucket).list(prefix);
    return (data || []).map((d) => `${prefix}${d.name}`);
  },
};

export default SupabaseStore;
