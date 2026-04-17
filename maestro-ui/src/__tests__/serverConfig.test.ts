import { describe, expect, it } from "vitest";

import {
  DEFAULT_API_BASE_URL,
  DEFAULT_SERVER_URL,
  DEFAULT_WS_URL,
  deriveServerUrl,
  deriveWsUrl,
  normalizeApiBaseUrl,
  normalizeWsUrl,
} from "../utils/serverConfig";

describe("serverConfig", () => {
  describe("normalizeApiBaseUrl", () => {
    it("falls back when the API URL is malformed", () => {
      expect(normalizeApiBaseUrl("localhost:4567/api")).toBe(DEFAULT_API_BASE_URL);
      expect(normalizeApiBaseUrl("not a url")).toBe(DEFAULT_API_BASE_URL);
    });

    it("strips wrapping quotes from the API URL", () => {
      expect(normalizeApiBaseUrl('  "http://localhost:9999/api"  ')).toBe("http://localhost:9999/api");
    });

    it("adds /api when the API URL only provides the server origin", () => {
      expect(normalizeApiBaseUrl("http://localhost:9999")).toBe("http://localhost:9999/api");
      expect(normalizeApiBaseUrl("http://localhost:9999/")).toBe("http://localhost:9999/api");
    });
  });

  describe("normalizeWsUrl", () => {
    it("derives the websocket URL from the API URL when no WS URL is provided", () => {
      expect(normalizeWsUrl(undefined, "http://localhost:9999/api")).toBe("ws://localhost:9999");
      expect(normalizeWsUrl(null, "https://maestro.dev/api")).toBe("wss://maestro.dev");
    });

    it("converts http(s) websocket overrides into ws(s)", () => {
      expect(normalizeWsUrl("http://localhost:9999/socket", DEFAULT_API_BASE_URL)).toBe("ws://localhost:9999/socket");
      expect(normalizeWsUrl("https://maestro.dev/socket?token=1", DEFAULT_API_BASE_URL)).toBe("wss://maestro.dev/socket?token=1");
    });

    it("falls back when the WS URL is malformed", () => {
      expect(normalizeWsUrl("localhost:9999", "http://localhost:9999/api")).toBe("ws://localhost:9999");
      expect(normalizeWsUrl("bad value", DEFAULT_API_BASE_URL)).toBe(DEFAULT_WS_URL);
    });
  });

  describe("derive helpers", () => {
    it("derives server and websocket origins from a valid API URL", () => {
      expect(deriveServerUrl("https://maestro.dev/api")).toBe("https://maestro.dev");
      expect(deriveWsUrl("https://maestro.dev/api")).toBe("wss://maestro.dev");
    });

    it("falls back to defaults for invalid API URLs", () => {
      expect(deriveServerUrl("bad value")).toBe(DEFAULT_SERVER_URL);
      expect(deriveWsUrl("bad value")).toBe(DEFAULT_WS_URL);
    });
  });
});
