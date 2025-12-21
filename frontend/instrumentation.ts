import { registerOTel } from "@vercel/otel";

export function register() {
  registerOTel({
    serviceName: "personal_automations-frontend",
  });
}
