// Vitest setup file
// Extends vitest matchers with jest-dom matchers (toBeDisabled, toBeVisible, etc.)
import "@testing-library/jest-dom/vitest"
import {vi} from "vitest"

// Default the backend health probe (utils/backendStatus, used by the
// data hooks to decide API vs Dexie-only mode) to "available", so page
// tests exercise the mocked api client instead of falling back to the
// empty Dexie cache. Tests that need the offline path stub fetch + call
// _resetBackendProbe() themselves (see OfflineBanner.test).
vi.stubGlobal(
  "fetch",
  vi.fn(async () => ({ok: true, status: 200, json: async () => ({})}) as unknown as Response),
)
