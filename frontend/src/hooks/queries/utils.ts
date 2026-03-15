export function toSearchParams(values: Record<string, unknown>) {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return;
    }

    if (Array.isArray(value)) {
      params.set(key, value.join(","));
      return;
    }

    if (typeof value === "boolean") {
      params.set(key, value ? "true" : "false");
      return;
    }

    params.set(key, String(value));
  });

  return params.toString();
}
