import { describe, expect, it } from "vitest";
import { resolveError } from "./catalog";
import { MBP } from "./codes";

describe("ERROR_CATALOG", () => {
  it("resolves known edge auth", () => {
    const r = resolveError(MBP.edge.authInvalidKey);
    expect(r.httpStatus).toBe(401);
  });

  it("falls back for unknown code", () => {
    const r = resolveError("MBP.unknown.code");
    expect(r.httpStatus).toBe(500);
  });
});
