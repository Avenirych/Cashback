import { BACKEND_URL } from "./backend";
/** Mailpit is available only in the explicitly supported local development setup. */
export function localTestMailboxEnabled(
  mode = process.env.NODE_ENV,
  origin = window.location.origin,
  api = BACKEND_URL
): boolean {
  return mode === "development" && (
    (["http://127.0.0.1:3005", "http://localhost:3005"].includes(origin) && api === "/api") ||
    (origin === "http://localhost:3004" && api === "http://127.0.0.1:3006")
  );
}
export const LOCAL_TEST_MAILBOX_URL = "http://127.0.0.1:8036/";
