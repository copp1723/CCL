import express, { Request, Response } from "express";
import { db } from "../db-postgres.js";
import { campaignDrafts } from "../../shared/schema.js";
import { eq } from "drizzle-orm";

const router = express.Router();

// List drafts
router.get("/drafts", async (_req: Request, res: Response) => {
  const rows = await db.select().from(campaignDrafts);
  res.json({ success: true, data: rows });
});

// Create draft
router.post("/drafts", async (req: Request, res: Response) => {
  try {
    const [draft] = await db.insert(campaignDrafts).values(req.body).returning();
    res.json({ success: true, data: draft });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Update draft (schedule)
router.patch("/drafts/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(campaignDrafts)
      .set(req.body)
      .where(eq(campaignDrafts.id, id))
      .returning();
    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
