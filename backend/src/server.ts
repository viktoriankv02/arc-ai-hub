import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { getChainStatus, getJob, getJobs, getRequest } from "./chain.js";

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

app.get("/api/jobs", async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 20);
    res.json(await getJobs(Number.isFinite(limit) ? limit : 20));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get("/api/jobs/:id", async (req, res) => {
  try {
    res.json(await getJob(req.params.id));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get("/api/requests/:id", async (req, res) => {
  try {
    res.json(await getRequest(req.params.id));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.listen(config.port, () => {
  console.log(`ARC AI Hub backend listening on http://localhost:${config.port}`);
});
