import { afterEach, describe, expect, it, vi } from "vitest";
import { request } from "./api";

afterEach(() => vi.unstubAllGlobals());
describe("API client", () => {
  it("sends cookies and JSON headers with requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { value: 3 } }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(request("/health")).resolves.toEqual({ value: 3 });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/health$/), expect.objectContaining({ credentials: "include", headers: expect.objectContaining({ "Content-Type": "application/json" }) }));
  });
  it("returns a readable API error message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { message: "Please sign in." } }) }));
    await expect(request("/profile")).rejects.toThrow("Please sign in.");
  });
});
