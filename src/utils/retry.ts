export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never happen, but keeps TS happy and code safe
  throw lastError instanceof Error
    ? lastError
    : new Error('Operation failed after retries');
}
