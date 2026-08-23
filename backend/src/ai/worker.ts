import { MockInferenceProvider } from "./providers.js";
import { executeOnChainAI } from "./onchainExecutor.js";
import type { AIExecutionRequest, AIExecutionResult, InferenceProvider, OnChainExecutionResult } from "./types.js";

export class AIWorker {
  constructor(private readonly provider: InferenceProvider = new MockInferenceProvider()) {}

  async execute(request: AIExecutionRequest): Promise<AIExecutionResult> {
    if (!request || typeof request !== "object") {
      throw new Error("AI request is required");
    }

    if (!request.model?.trim()) {
      throw new Error("AI model is required");
    }

    if (!request.input?.trim()) {
      throw new Error("AI input is required");
    }

    return this.provider.execute({
      ...request,
      model: request.model.trim(),
      input: request.input,
      parameters: request.parameters ?? {},
    });
  }

  async executeOnChain(request: AIExecutionRequest): Promise<{
    inference: AIExecutionResult;
    onChain: OnChainExecutionResult;
  }> {
    const inference = await this.execute(request);
    const onChain = await executeOnChainAI(request, inference);
    return { inference, onChain };
  }
}

export const aiWorker = new AIWorker();
