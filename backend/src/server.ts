import express from "express";
import cors from "cors";
import { config } from "./config.js";
import {
  getAgent,
  getAgents,
  getChainStatus,
  getJob,
  getJobs,
  getNode,
  getNodes,
  getPlatformStats,
  getRequest,
} from "./chain.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    const chain = await getChainStatus();
    res.json({
      ok: true,
      backend: true,
      chainOk: true,
      service: "arc-ai-hub-backend",
      chain,
      contracts: {
        jobManager: Boolean(config.jobManager),
        gateway: Boolean(config.gateway),
        agentRegistry: Boolean(config.agentRegistry),
        computePool: Boolean(config.computePool),
        reputation: Boolean(config.reputation),
      },
    });
  } catch (error) {
    res.status(200).json({
      ok: true,
      backend: true,
      chainOk: false,
      service: "arc-ai-hub-backend",
      error: String(error),
      rpc: config.rpcUrl,
      contracts: {
        jobManager: Boolean(config.jobManager),
        gateway: Boolean(config.gateway),
        agentRegistry: Boolean(config.agentRegistry),
        computePool: Boolean(config.computePool),
        reputation: Boolean(config.reputation),
      },
    });
  }
});

app.get("/api/stats", async (_req, res) => {
  try {
    const [chain, stats] = await Promise.all([getChainStatus(), getPlatformStats()]);
    res.json({ chain, ...stats });
  } catch (error) {
    res.status(503).json({ error: String(error) });
  }
});

app.get("/api/jobs", async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 20);
    res.json(await getJobs(Number.isFinite(limit) ? limit : 20));
  } catch (error) {
    res.status(503).json({ error: String(error) });
  }
});

app.get("/api/jobs/:id", async (req, res) => {
  try {
    res.json(await getJob(req.params.id));
  } catch (error) {
    res.status(503).json({ error: String(error) });
  }
});

app.get("/api/requests/:id", async (req, res) => {
  try {
    res.json(await getRequest(req.params.id));
  } catch (error) {
    res.status(503).json({ error: String(error) });
  }
});

app.get("/api/agents", async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 20);
    res.json(await getAgents(Number.isFinite(limit) ? limit : 20));
  } catch (error) {
    res.status(503).json({ error: String(error) });
  }
});

app.get("/api/agents/:id", async (req, res) => {
  try {
    res.json(await getAgent(req.params.id));
  } catch (error) {
    res.status(503).json({ error: String(error) });
  }
});

app.get("/api/nodes", async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 20);
    res.json(await getNodes(Number.isFinite(limit) ? limit : 20));
  } catch (error) {
    res.status(503).json({ error: String(error) });
  }
});

app.get("/api/nodes/:id", async (req, res) => {
  try {
    res.json(await getNode(req.params.id));
  } catch (error) {
    res.status(503).json({ error: String(error) });
  }
});

app.listen(config.port, () => {
  console.log(`ARC AI Hub backend listening on http://localhost:${config.port}`);
});
