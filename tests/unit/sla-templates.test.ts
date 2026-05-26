import { describe, expect, it } from "vitest";
import { slaTemplates, findSlaTemplate } from "@/lib/domain/sla-templates";

describe("slaTemplates", () => {
  it("includes the custom blank template first", () => {
    expect(slaTemplates[0].id).toBe("custom");
    expect(slaTemplates[0].terms.availabilityTarget).toBe("");
  });

  it("has at least three concrete tier templates", () => {
    const concrete = slaTemplates.filter((t) => t.id !== "custom");
    expect(concrete.length).toBeGreaterThanOrEqual(3);
  });

  it("every template has the five term fields", () => {
    for (const template of slaTemplates) {
      expect(template.terms).toMatchObject({
        availabilityTarget: expect.any(String),
        errorThreshold: expect.any(String),
        latencyThreshold: expect.any(String),
        exclusions: expect.any(String),
        creditRule: expect.any(String),
      });
    }
  });

  it("template ids are unique", () => {
    const ids = slaTemplates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("findSlaTemplate returns the matching template", () => {
    expect(findSlaTemplate("rpc-99-9-monthly")?.terms.availabilityTarget).toBe(
      "99.9% monthly",
    );
    expect(findSlaTemplate("nonexistent")).toBeUndefined();
  });
});
