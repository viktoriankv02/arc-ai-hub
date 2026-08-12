import { Router } from "express";
import { listAgents } from "../agentRegistry";
import { listComputeNodes } from "../nodeRegistry";

export const registryRouter = Router();

registryRouter.get("/agents", async (_req, res) => {
  try {
    res.json({ agents: await listAgents() });
  } catch (error) {
    res.status(503).json({ error: "Agent registry unavailable" });
  }
});

registryRouter.get("/nodes", async (_req, res) => {
  try {
    res.json({ nodes: await listComputeNodes() });
  } catch (error) {
    res.status(503).json({ error: "Compute pool unavailable" });
  }
});
