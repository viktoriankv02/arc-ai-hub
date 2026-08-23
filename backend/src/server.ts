import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { getChains } from "./chains/index.js";
import { getAgent, getAgents, getChainStatus, getJob, getJobs, getNode, getNodes, getPlatformStats, getRequest } from "./chain.js";
import { aiWorker } from "./ai/worker.js";
import type { AIExecutionRequest } from "./ai/types.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/chains", (_req, res) => res.json(getChains()));

app.get("/api/health", async (_req, res) => {
  try {
    const chain = await getChainStatus();
    res.json({ ok: true, backend: true, chainOk: true, service: "arc-ai-hub-backend", chain,
      contracts: { jobManager: Boolean(config.jobManager), gateway: Boolean(config.gateway), agentRegistry: Boolean(config.agentRegistry), computePool: Boolean(config.computePool), reputation: Boolean(config.reputation) } });
  } catch (error) {
    res.status(200).json({ ok: true, backend: true, chainOk: false, service: "arc-ai-hub-backend", error: String(error), rpc: config.rpcUrl,
      contracts: { jobManager: Boolean(config.jobManager), gateway: Boolean(config.gateway), agentRegistry: Boolean(config.agentRegistry), computePool: Boolean(config.computePool), reputation: Boolean(config.reputation) } });
  }
});

app.get("/api/stats", async (_req, res) => {
  try { const [chain, stats] = await Promise.all([getChainStatus(), getPlatformStats()]); res.json({ chain, ...stats }); }
  catch (error) { res.status(503).json({ error: String(error) }); }
});

app.get("/api/jobs", async (req, res) => {
  try { const limit = Number(req.query.limit ?? 20); res.json(await getJobs(Number.isFinite(limit) ? limit : 20)); }
  catch (error) { res.status(503).json({ error: String(error) }); }
});
app.get("/api/jobs/:id", async (req, res) => {
  try { res.json(await getJob(req.params.id)); } catch (error) { res.status(503).json({ error: String(error) }); }
});
app.get("/api/requests/:id", async (req, res) => {
  try { res.json(await getRequest(req.params.id)); } catch (error) { res.status(503).json({ error: String(error) }); }
});
app.get("/api/agents", async (req, res) => {
  try { const limit = Number(req.query.limit ?? 20); res.json(await getAgents(Number.isFinite(limit) ? limit : 20)); }
  catch (error) { res.status(503).json({ error: String(error) }); }
});
app.get("/api/agents/:id", async (req, res) => {
  try { res.json(await getAgent(req.params.id)); } catch (error) { res.status(503).json({ error: String(error) }); }
});
app.get("/api/nodes", async (req, res) => {
  try { const limit = Number(req.query.limit ?? 20); res.json(await getNodes(Number.isFinite(limit) ? limit : 20)); }
  catch (error) { res.status(503).json({ error: String(error) }); }
});
app.get("/api/nodes/:id", async (req, res) => {
  try { res.json(await getNode(req.params.id)); } catch (error) { res.status(503).json({ error: String(error) }); }
});

/** V2.1 off-chain execution boundary. Safe mock/local inference endpoint. */
app.post("/api/ai/execute", async (req, res) => {
  try {
    const result = await aiWorker.execute(req.body as AIExecutionRequest);
    res.status(200).json({ ok: true, result });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error) });
  }
});

/**
 * V2.1 full execution boundary.
 *
 * Flow:
 *   AI inference -> Gateway request -> Manager job -> node assignment
 *   -> job start -> job finish -> Gateway request processed.
 *
 * The executor signer must be the deployed contract owner for the current
 * testnet Manager V2, because assign/start/finish are owner-authorized.
 */
app.post("/api/ai/execute-onchain", async (req, res) => {
  try {
    const result = await aiWorker.executeOnChain(req.body as AIExecutionRequest);
    res.status(200).json({ ok: true, result });
  } catch (error) {
    console.error("/api/ai/execute-onchain failed:", error);
    res.status(400).json({ ok: false, error: String(error) });
  }
});

app.listen(config.port, () => console.log(`ARC AI Hub backend listening on http://localhost:${config.port}`));
