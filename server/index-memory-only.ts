import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import multer from "multer";
import cors from "cors";

// Simple in-memory only version for testing
const app = express();
const server = createServer(app);
const PORT = parseInt(process.env.PORT || "5000", 10);

app.use(cors());
app.use(express.json());

// In-memory storage
const storage = {
  leads: [],
  activities: [],
  agents: [
    { id: "agent_1", name: "VisitorIdentifierAgent", status: "active" },
    { id: "agent_2", name: "RealtimeChatAgent", status: "active" }
  ],
  
  async createLead(data: any) {
    const lead = { id: `lead_${Date.now()}`, ...data, createdAt: new Date() };
    this.leads.push(lead);
    return lead;
  },
  
  async getLeads() { return this.leads; },
  async getAgents() { return this.agents; }
};

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "healthy", mode: "memory-only" });
});

// API routes
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  
  let response = "Hi! I'm Cathy from Complete Car Loans. How can I help you today?";
  
  // Try OpenAI if available
  if (process.env.OPENAI_API_KEY) {
    try {
      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [
            { role: "system", content: "You are Cathy from Complete Car Loans. Be helpful and concise." },
            { role: "user", content: message }
          ],
          max_tokens: 150
        }),
      });
      
      if (openaiResponse.ok) {
        const data = await openaiResponse.json();
        response = data.choices[0]?.message?.content || response;
      }
    } catch (error) {
      console.error("OpenAI error:", error);
    }
  }
  
  res.json({ response });
});

// Start server
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Memory-only server running on port ${PORT}`);
});