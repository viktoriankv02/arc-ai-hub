export type AIParameters = Record<string, string | number | boolean | null>;

export interface AIExecutionRequest {
  model: string;
  input: string;
  parameters?: AIParameters;
  serviceId?: string | number;
  agentId?: string | number;
  nodeId?: string | number;
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

export interface OnChainExecutionResult {
  requestId: string;
  jobId: string;
  agentId: string;
  nodeId: string;
  status: "finished";
  payloadHash: string;
  signer: string;
  outputHash: string;
}

export interface InferenceProvider {
  execute(request: AIExecutionRequest): Promise<AIExecutionResult>;
}
