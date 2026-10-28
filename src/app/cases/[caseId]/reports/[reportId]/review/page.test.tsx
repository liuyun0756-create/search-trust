// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Page from "./page";
import fixture from "@/lib/review-reports/contracts/fixture.json";
import { initialReviewRevision } from "@/lib/review-reports/delivery";
const mocks = vi.hoisted(() => ({
  multi: true,
  latest: vi.fn(),
  approvals: vi.fn(),
  impl: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("not-found");
  },
  redirect: () => {
    throw Error("redirect");
  },
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: async () => ({
    userId: "11111111-1111-4111-8111-111111111111",
  }),
}));
vi.mock("@/lib/supabase", () => ({ createServerClient: () => ({}) }));
vi.mock("@/lib/review-reports/config", () => ({
  isReviewDeliveryEnabled: () => true,
}));
vi.mock("@/lib/review-intake/multi-round-config", () => ({
  isMultiRoundReviewsEnabled: () => mocks.multi,
}));
vi.mock("@/lib/review-reports/repository", () => ({
  ReviewDeliveryRepository: class {
    db = {};
    async report() {
      return fixture.reports.baseline;
    }
    revision = mocks.latest;
    async history() {
      return [];
    }
  },
}));
vi.mock("@/lib/implementation-records/repository", () => ({
  ImplementationRepository: class {
    approvedVersions = mocks.approvals;
  },
}));
vi.mock("@/components/report/ImplementationRecords", () => ({
  ImplementationRecords: (props: { deliveryRevisionId: string }) => {
    mocks.impl(props);
    return <p>Implementation for {props.deliveryRevisionId}</p>;
  },
}));
vi.mock("@/components/report/review-delivery/ReviewDocument", () => ({
  ReviewDocument: () => null,
}));
vi.mock("@/components/report/review-delivery/ReviewEditor", () => ({
  ReviewEditor: () => null,
}));
vi.mock("@/components/report/CapabilityDeliveryActions", () => ({
  CapabilityDeliveryActions: () => null,
}));
const id = "12121212-1212-4212-8212-121212121212",
  r = fixture.reports.baseline;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.multi = true;
  mocks.approvals.mockResolvedValue([{ id, revision: 1 }]);
  mocks.latest.mockResolvedValue({
    id,
    revision: 1,
    status: "approved",
    content: { ...initialReviewRevision(r as never), status: "approved" },
  });
});
afterEach(cleanup);
const page = () =>
  Page({
    params: Promise.resolve({ caseId: r.business.case_id, reportId: r.id }),
    searchParams: Promise.resolve({}),
  });
it("opens the next cycle against the exact approved plan", async () => {
  render(await page());
  expect(
    screen.getByRole("heading", {
      name: "Record the work. Prepare your next review.",
    }),
  ).toBeVisible();
  expect(mocks.impl).toHaveBeenCalledWith(
    expect.objectContaining({
      reportId: r.id,
      deliveryRevisionId: id,
      reviewWorkspaceEnabled: true,
    }),
  );
  expect(
    screen.getByRole("link", { name: "Approved revision 1" }),
  ).toHaveAttribute(
    "href",
    expect.stringContaining(`revision=${id}#implementation-records`),
  );
});
it("retains the earlier approved source while a later delivery is a draft", async () => {
  mocks.latest.mockResolvedValue({
    id: "34343434-3434-4343-8343-343434343434",
    revision: 2,
    status: "draft",
    content: initialReviewRevision(r as never),
  });
  render(await page());
  expect(mocks.impl).toHaveBeenCalledWith(
    expect.objectContaining({ deliveryRevisionId: id }),
  );
});
it("requires an approved version before implementation", async () => {
  mocks.approvals.mockResolvedValue([]);
  mocks.latest.mockResolvedValue(null);
  render(await page());
  expect(
    screen.getByText(/Approve a saved delivery version to begin/),
  ).toBeVisible();
  expect(mocks.impl).not.toHaveBeenCalled();
});
it("keeps the new cycle entry absent when disabled", async () => {
  mocks.multi = false;
  render(await page());
  expect(mocks.approvals).not.toHaveBeenCalled();
  expect(mocks.impl).not.toHaveBeenCalled();
  expect(screen.queryByText("Next review cycle")).toBeNull();
});
