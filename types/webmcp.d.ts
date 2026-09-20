type WebMcpTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(input: unknown): unknown | Promise<unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
};

interface WebMcpContext {
  registerTool(
    tool: WebMcpTool,
    options?: { signal?: AbortSignal },
  ): void | Promise<void>;
}

declare global {
  interface Document {
    readonly modelContext?: WebMcpContext;
  }
}

export {};

