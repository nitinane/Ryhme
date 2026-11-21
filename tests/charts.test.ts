import { expect, it } from "vitest";
import { scoreLabel, scoreScale } from "../src/features/benchmarks/chart-data";

it("preserves exact displayed scores and uses a common percent axis", () => {
  const points = [
    { slug: "first", name: "First", score: "54.60000000", sourceUrl: "" },
    { slug: "second", name: "Second", score: "23.60000000", sourceUrl: "" },
  ];
  const scale = scoreScale(points, "%");
  expect([scale.min, scale.max]).toEqual([0, 100]);
  expect(scale.position(54.6)).toBeCloseTo(54.6);
  expect(scoreLabel(points[0].score, "%")).toBe("54.6%");
  expect(scoreLabel("0.00000000", "ms")).toBe("0 ms");
});

it("includes zero in signed score ranges and handles a zero-only cohort", () => {
  const point = { slug: "first", name: "First", score: "-5", sourceUrl: "" };
  const scale = scoreScale([point, { ...point, score: "15" }], "ms");
  expect([scale.min, scale.max, scale.position(0)]).toEqual([-5, 15, 25]);
  expect(scoreScale([{ ...point, score: "0" }], "ms").position(0)).toBe(0);
});
