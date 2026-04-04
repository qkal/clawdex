export interface MockToolCall {
  tool: string;
  args: Record<string, unknown>;
}

export interface MockLLMResponse {
  message?: string;
  toolCalls?: MockToolCall[];
}

export interface MockLLMClientOptions {
  responses?: string[];
  toolCalls?: MockToolCall[];
}

export class MockLLMClient {
  private readonly responses: string[];
  private readonly toolCalls: MockToolCall[];
  readonly history: string[] = [];

  constructor(options: MockLLMClientOptions = {}) {
    this.responses = options.responses ?? [];
    this.toolCalls = options.toolCalls ?? [];
  }

  async *stream(prompt: string): AsyncGenerator<string> {
    this.history.push(prompt);
    for (const chunk of this.responses) {
      yield chunk;
    }
  }

  async complete(prompt: string): Promise<MockLLMResponse> {
    this.history.push(prompt);
    return {
      message: this.responses.join(""),
      toolCalls: this.toolCalls.length > 0 ? this.toolCalls : undefined,
    };
  }
}
