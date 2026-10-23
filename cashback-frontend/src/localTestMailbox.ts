import { BACKEND_URL } from "./backend";
/** Exact local development boundary; never enable on another host or API. */
export function localTestMailboxEnabled(
  mode = process.env.NODE_ENV,
  origin = window.location.origin,
  api = BACKEND_URL
): boolean {
  return (mode === "development"||process.env.REACT_APP_LOCAL_DEMO_REVIEWS==='true') && origin === "http://localhost:3004" && api === "http://127.0.0.1:3006";
}
export const LOCAL_TEST_MAILBOX_URL = "http://127.0.0.1:8036/";
