// @vitest-environment jsdom
import {render, screen, fireEvent} from "@testing-library/react";
import {afterEach, expect, it, vi} from "vitest";
import {MetricReadingGuide} from "./MetricReadingGuide";
import vectors from "@/lib/comparison-checks/metric-reading-contracts/fixtures.json";
import type {ComparisonView} from "@/lib/comparison-checks/types";
const result = (name: string) => structuredClone(vectors.find(v => v.name === name)!.result) as ComparisonView["result"];
afterEach(() => vi.unstubAllGlobals());
it("explains a one-click increase with counts and denominators, without a request or effect conclusion", () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  render(<MetricReadingGuide result={result("one_to_two")}/>);
  expect(screen.getByRole("region", {name: "What these numbers can support"})).toBeVisible();
  expect(screen.getByText("1 → 2 clicks")).toBeVisible();
  expect(screen.getByText(/entire observed difference is one click/)).toBeVisible();
  expect(screen.getByText(/100 percentage points/)).toBeVisible();
  expect(screen.getByText(/Numerical resolution is not confidence/)).toBeVisible();
  fireEvent.click(screen.getByText("How this reading aid is calculated"));
  expect(screen.getByText(/Larger counts do not automatically qualify/)).toBeVisible();
  expect(screen.getByText(/v22_metric_resolution_v1/)).toBeVisible(); expect(fetcher).not.toHaveBeenCalled();
  expect(screen.queryByRole("button")).toBeNull();
});
it("keeps missing denominators and zero baseline undefined, not zero-percent success", () => {
  render(<MetricReadingGuide result={result("no_before_impressions")}/>);
  expect(screen.getAllByText(/baseline is zero/)).toHaveLength(2);
  expect(screen.getByText(/CTR change cannot be calculated/)).toBeVisible();
  expect(screen.getByText(/an undefined amount before/)).toBeVisible();
});
it("does not treat unchanged metrics as proof of no effect", () => {
  render(<MetricReadingGuide result={result("unchanged")}/>);
  expect(screen.getAllByText(/Equal totals do not establish/)).toHaveLength(2);
  expect(screen.getByText(/ratios are equal/)).toBeVisible();
});
it.each(["missing_source", "ga4_withheld"])("does not show fabricated trend cards when %s", name => {
  render(<MetricReadingGuide result={result(name)}/>);
  expect(screen.getByText(/no trend interpretation/)).toBeVisible();
  expect(screen.queryByText("Clicks · count first")).toBeNull();
  expect(screen.getByText(/Do not substitute zero/)).toBeVisible();
});
it("withholds inconsistent arithmetic", () => {
  const r = result("one_to_two"); r.metrics[0].absolute_change = 100;
  render(<MetricReadingGuide result={r}/>);
  expect(screen.getByRole("alert")).toBeVisible(); expect(screen.queryByRole("region")).toBeNull();
});
