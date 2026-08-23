export type AIParameters = Record<string, string | number | boolean | null>;

export interface AIExecutionRequest {
  model: string;
  input: string;
  parameters?: AIParameters;
}

export interface AIExecutionResult {
  model: string;
  output: string;
  inputHash: string;
  outputHash: string;
  startedAt: number;
  completedAt: number;
  durationMs: number;
}

export interface InferenceProvider {
  execute(request: AIExecutionRequest): Promise<AIExecutionResult>;
}
