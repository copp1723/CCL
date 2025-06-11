import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { ObjectStore } from ".";

const s3 = new S3Client({ region: process.env.AWS_REGION });
const Bucket = process.env.S3_BUCKET!;

const S3Store: ObjectStore = {
  async put(key, data, mimeType) {
    await s3.send(new PutObjectCommand({ Bucket, Key: key, Body: data, ContentType: mimeType }));
  },
  async get(key) {
    const { Body } = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
    if (!Body) return null;
    const chunks: Buffer[] = [];
    for await (const chunk of Body as Readable) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  },
  async remove(key) {
    await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
  },
  async list(prefix = "") {
    const { Contents } = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: prefix }));
    return (Contents || []).map((c) => c.Key!).filter(Boolean);
  },
};

export default S3Store;
