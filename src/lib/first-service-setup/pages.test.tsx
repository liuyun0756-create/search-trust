import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CaseApiError } from "@/lib/cases/errors";
import { connectionCenterFixture } from "../../../e2e/fixtures/google";
import { preflightFixture } from "../../../e2e/fixtures/preflight";
import SetupPage from "@/app/cases/[caseId]/service-setup/page";
import PreparePage from "@/app/cases/service/prepare/page";
import NewClientPage from "@/app/cases/service/new/page";

const mocks = vi.hoisted(() => ({
  enabled: vi.fn(),
  available: vi.fn(),
  user: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  connections: vi.fn(),
  oauth: vi.fn(),
  completed: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ createServerClient: () => ({}) }));
vi.mock("@/lib/report-capability/repository", () => ({
  CapabilityRepository: class {
    listCompletedReports = mocks.completed;
  },
}));
vi.mock("@/lib/first-service-setup/config", () => ({
  isFirstServiceSetupEnabled: mocks.enabled,
  isFirstServiceSetupAvailable: mocks.available,
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/cases", () => ({
  createServerCaseService: () => ({ get: mocks.get, list: mocks.list }),
}));
vi.mock("@/lib/connection-center", () => ({
  createServerConnectionCenterService: () => ({ get: mocks.connections }),
}));
vi.mock("@/lib/google-connections", () => ({
  createServerGoogleConnectionService: mocks.oauth,
}));
vi.mock("@/components/cases/first-service-connections", () => ({
  FirstServiceConnections: () => <div>First-service preparation</div>,
}));
vi.mock("@/components/cases/first-service-client", () => ({
  FirstServiceClient: () => <div>Client confirmation</div>,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
const id = "00000000-0000-4000-8000-000000000123";
const props = { params: Promise.resolve({ caseId: id }) };
beforeEach(() => {
  vi.stubEnv("V22_CAPABILITY_DISPATCH_ENABLED", "false");
  vi.resetAllMocks();
  mocks.enabled.mockReturnValue(true);
  mocks.available.mockReturnValue(true);
  mocks.user.mockResolvedValue({ userId: "owner" });
  mocks.get.mockResolvedValue({
    id,
    status: "active",
    site_url: "https://example.test",
    business_name: "Client",
    primary_service: "Repair",
    target_market: { display_name: "Austin" },
    business_identity: preflightFixture.identity_candidates[0].business,
  });
  const center = connectionCenterFixture("needs_resources");
  center.case.id = id;
  center.coverage.parent_report_id = null;
  mocks.connections.mockResolvedValue(center);
  mocks.list.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
});
afterEach(() => vi.unstubAllEnvs());

describe("first-service setup pages", () => {
  it("keeps all three routes closed before authentication or storage when the flag is disabled", async () => {
    mocks.enabled.mockReturnValue(false);
    mocks.available.mockReturnValue(false);
    await expect(SetupPage(props)).rejects.toThrow("NOT_FOUND");
    await expect(
      PreparePage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(NewClientPage()).rejects.toThrow("NOT_FOUND");
    expect(mocks.user).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("requires authentication and retains the same owned setup destination", async () => {
    mocks.user.mockResolvedValue(null);
    await expect(SetupPage(props)).rejects.toThrow(
      `REDIRECT:/sign-in?redirect_url=${encodeURIComponent(`/cases/${id}/service-setup`)}`,
    );
    expect(mocks.get).not.toHaveBeenCalled();
    await expect(NewClientPage()).rejects.toThrow("REDIRECT:/sign-in");
    await expect(
      PreparePage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/sign-in");
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("loads a no-Prospect Case using the authenticated owner in both repositories", async () => {
    expect(renderToStaticMarkup(await SetupPage(props))).toContain(
      "First-service preparation",
    );
    expect(mocks.get).toHaveBeenCalledWith("owner", id);
    expect(mocks.connections).toHaveBeenCalledWith("owner", id);
    expect(mocks.oauth).toHaveBeenCalledOnce();
  });
  it("rejects a missing, foreign, archived or malformed Case before loading its connections", async () => {
    mocks.get.mockRejectedValueOnce(CaseApiError.notFound());
    await expect(SetupPage(props)).rejects.toThrow("NOT_FOUND");
    mocks.get.mockResolvedValueOnce({ id, status: "archived" });
    await expect(SetupPage(props)).rejects.toThrow("NOT_FOUND");
    await expect(
      SetupPage({ params: Promise.resolve({ caseId: "bad-id" }) }),
    ).rejects.toThrow("NOT_FOUND");
    expect(mocks.connections).not.toHaveBeenCalled();
  });
  it("keeps existing Prospect-to-service Cases on their current connection flow", async () => {
    const center = connectionCenterFixture("needs_resources");
    center.coverage.parent_report_id = "existing-prospect";
    mocks.connections.mockResolvedValue(center);
    await expect(SetupPage(props)).rejects.toThrow(
      `REDIRECT:/cases/${id}/connections`,
    );
  });
  it("continues a completed capability report instead of presenting another first diagnosis", async () => {
    vi.stubEnv("V22_CAPABILITY_DISPATCH_ENABLED", "true");
    mocks.completed.mockResolvedValue([
      { caseId: id, reportId: "completed-report" },
    ]);
    await expect(SetupPage(props)).rejects.toThrow(
      `REDIRECT:/cases/${id}/reports/completed-report`,
    );
    expect(mocks.completed).toHaveBeenCalledWith("owner");
    expect(mocks.connections).not.toHaveBeenCalled();
  });
  it("lists owned active Cases without any Prospect filter and paginates", async () => {
    await PreparePage({ searchParams: Promise.resolve({ page: "2" }) });
    expect(mocks.list).toHaveBeenCalledWith("owner", {
      status: "active",
      limit: 20,
      offset: 20,
    });
    expect(mocks.connections).not.toHaveBeenCalled();
  });
  it("renders storage failure as an error rather than an empty client list", async () => {
    mocks.list.mockRejectedValue(new Error("storage"));
    const html = renderToStaticMarkup(
      await PreparePage({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Clients could not be loaded");
    expect(html).not.toContain("No clients on this page");
  });
  it("normalizes invalid page numbers and offers the next page", async () => {
    mocks.list.mockResolvedValue({
      items: [],
      total: 22,
      limit: 20,
      offset: 0,
    });
    const html = renderToStaticMarkup(
      await PreparePage({ searchParams: Promise.resolve({ page: "-7" }) }),
    );
    expect(mocks.list).toHaveBeenCalledWith(
      "owner",
      expect.objectContaining({ offset: 0 }),
    );
    expect(html).toContain("Next page");
  });
});

it("keeps an owned existing setup page reachable while new intake routes are paused", async () => {
  mocks.enabled.mockReturnValue(false);
  mocks.available.mockReturnValue(true);
  vi.stubEnv("V22_PUBLIC_ENTRY_ENABLED", "false");
  const html = renderToStaticMarkup(await SetupPage(props));
  expect(html).toContain("First-service preparation");
  expect(mocks.get).toHaveBeenCalledWith("owner", id);
  await expect(NewClientPage()).rejects.toThrow("NOT_FOUND");
});
