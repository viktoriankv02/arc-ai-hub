import { createHash } from "node:crypto";
import type {
  AIExecutionRequest,
  AIExecutionResult,
  InferenceProvider,
} from "./types.js";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Deterministic provider used to validate the V2.1 execution contract before
 * connecting an external model provider. It deliberately performs no network
 * calls and is safe for local/testnet development.
 */
export class MockInferenceProvider implements InferenceProvider {
  async execute(request: AIExecutionRequest): Promise<AIExecutionResult> {
    const startedAt = Date.now();
    const inputHash = sha256(JSON.stringify(request));

    const output = [
      `[mock:${request.model}]`,
      `input=${request.input}`,
      request.parameters
        ? `parameters=${JSON.stringify(request.parameters)}`
        : "parameters={}",
    ].join(" ");

    const outputHash = sha256(output);
    const completedAt = Date.now();

    return {
      model: request.model,
      output,
      inputHash,
      outputHash,
      startedAt,
      completedAt,
      durationMs: completedAt - startedAt,
    };
  }
}
