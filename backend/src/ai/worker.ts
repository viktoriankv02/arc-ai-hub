import { MockInferenceProvider } from "./providers.js";
import type { AIExecutionRequest, AIExecutionResult, InferenceProvider } from "./types.js";

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
      model: request.model.trim(),
      input: request.input,
      parameters: request.parameters ?? {},
    });
  }
}

export const aiWorker = new AIWorker();
