export class TransientProviderError extends Error {
  constructor(
    message: string,
    readonly originalError?: unknown,
  ) {
    super(message);
    this.name = "TransientProviderError";
  }
}
