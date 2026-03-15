export function extractErrorMessage(errorData: unknown, fallback: string): string {
  if (typeof errorData === "string" && errorData.trim().length > 0) {
    return errorData;
  }

  if (!errorData || typeof errorData !== "object") {
    return fallback;
  }

  const data = errorData as Record<string, unknown>;

  if (typeof data.detail === "string" && data.detail.trim().length > 0) {
    return data.detail;
  }

  if (typeof data.message === "string" && data.message.trim().length > 0) {
    return data.message;
  }

  if (data.error && typeof data.error === "object") {
    const nestedError = data.error as Record<string, unknown>;
    if (typeof nestedError.message === "string" && nestedError.message.trim().length > 0) {
      return nestedError.message;
    }
  }

  return fallback;
}
