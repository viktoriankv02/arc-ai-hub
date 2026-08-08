import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { getChainStatus, getJob } from "./chain.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    const chain = await getChainStatus();
    res.json({ ok: true, service: "arc-ai-hub-backend", chain });
  } catch (error) {
    res.status(503).json({ ok: false, error: String(error) });
  }
});

app.get("/api/jobs/:id", async (req, res) => {
  try {
    const job = await getJob(req.params.id);
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.listen(config.port, () => {
  console.log(`ARC AI Hub backend listening on http://localhost:${config.port}`);
});
