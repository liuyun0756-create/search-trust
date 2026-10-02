// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MethodDelivery } from "./MethodDelivery";
import { MethodCTA } from "./MethodV22";
import { SampleReportsV22 } from "../sampleReport/SampleReportsV22";
import example from "./delivery-example.json";

const { push, track } = vi.hoisted(() => ({ push: vi.fn(), track: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/analytics-client", () => ({ track }));
afterEach(() => { vi.restoreAllMocks(); push.mockClear(); track.mockClear(); });

describe("client delivery module", () => {
  it("defaults to a readable client report with an explicit example label", () => {
    render(<MethodDelivery />);
    expect(screen.getByRole("button", { name: "Client report view" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "SEO working view" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("article")).toHaveTextContent(example.views.client.title);
    expect(screen.getByText(example.label)).toBeVisible();
    expect(screen.getByText(example.scope)).toBeVisible();
    expect(screen.getByText(/Real reports support a versioned SEO plan/)).toBeVisible();
  });

  it("changes expression while preserving the same evidence, conditions and status", async () => {
    const user = userEvent.setup(); render(<MethodDelivery />);
    for (const role of ["seo", "client", "seo"] as const) {
      await user.click(screen.getByRole("button", { name: example.views[role].label }));
      const report = within(screen.getByRole("article"));
      expect(report.getByRole("heading", { name: example.views[role].title })).toBeVisible();
      for (const fact of example.evidence) expect(report.getByText(fact.text)).toBeVisible();
      for (const condition of example.pending) expect(report.getByText(condition)).toBeVisible();
      for (const status of example.status) expect(report.getByText(status.text)).toBeVisible();
      expect(report.getByText(example.limitations)).toBeVisible();
      expect(screen.getByRole("status")).toHaveTextContent(example.views[role].label);
      expect(report.getByText(new RegExp(example.action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).toBeVisible();
    }
  });

  it("supports keyboard switching without moving focus unexpectedly", async () => {
    const user = userEvent.setup(); render(<MethodDelivery />);
    const seo = screen.getByRole("button", { name: "SEO working view" }); seo.focus();
    await user.keyboard("{Enter}"); expect(seo).toHaveFocus(); expect(seo).toHaveAttribute("aria-pressed", "true");
    await user.tab(); await user.keyboard(" ");
    expect(screen.getByRole("button", { name: "Client report view" })).toHaveAttribute("aria-pressed", "true");
  });

  it("previews the client view in place and focuses its visible heading", async () => {
    const user = userEvent.setup(); const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    render(<MethodDelivery />); await user.click(screen.getByRole("button", { name: "SEO working view" }));
    await user.click(screen.getByRole("button", { name: "Preview client report" }));
    expect(screen.getByRole("button", { name: "Client report view" })).toHaveAttribute("aria-pressed", "true");
    const heading = screen.getByRole("heading", { name: "One finding. Two ways to read it." });
    expect(heading).toHaveFocus(); expect(heading).toHaveClass("scroll-mt-28");
    expect(scroll).toHaveBeenCalledWith({ block: "start" });
  });

  it("links only to static PDF and sample materials, not real share APIs", () => {
    render(<MethodDelivery />);
    const materials = within(screen.getByRole("complementary", { name: "Sample delivery materials" }));
    const pdf = materials.getByRole("link", { name: /View PDF sample/ });
    expect(pdf).toHaveAttribute("href", "/samples/searchtrust-client-delivery-example.pdf");
    expect(pdf).toHaveAttribute("rel", "noopener noreferrer");
    expect(materials.getByRole("link", { name: "View full report sample" })).toHaveAttribute("href", "/sample-report#report-scenarios");
    for (const link of screen.getAllByRole("link")) expect(link.getAttribute("href")).not.toMatch(/\/api\/|\/share/);
  });

  it("keeps public proposal evidence distinct from connected-client performance", () => {
    render(<MethodDelivery />);
    const prospect = within(screen.getByRole("region", { name: example.scenarios[0].title }));
    expect(prospect.getByText("Three proposed priority actions")).toBeVisible();
    for (const action of example.scenarios[0].actions) expect(prospect.getByText(action)).toBeVisible();
    expect(prospect.getByText(example.scenarios[0].boundary)).toBeVisible();
    expect(prospect.queryByText(example.evidence[0].text)).not.toBeInTheDocument();
    const service = within(screen.getByRole("region", { name: example.scenarios[1].title }));
    expect(service.getByText(example.scenarios[1].boundary)).toBeVisible();
  });

  it("preserves the review sequence and delivery-version boundaries without fake approvals", () => {
    render(<MethodDelivery />);
    for (const title of ["Review the judgment", "Confirm the plan", "Preview the delivery"]) expect(screen.getByRole("heading", { name: title })).toBeVisible();
    for (const label of ["Report version", "Client visibility", "Unconfirmed information", "Later changes"]) expect(screen.getByText(label)).toBeVisible();
    expect(screen.getByText(/does not save approval, send reports or change a real plan/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /send|approve|share|export/i })).not.toBeInTheDocument();
  });

  it("uses unique IDs and makes no API calls or persistent writes during preview", async () => {
    const user = userEvent.setup(); const api = vi.spyOn(globalThis, "fetch");
    const storage = vi.spyOn(Storage.prototype, "setItem"); const { container } = render(<MethodDelivery />);
    await user.click(screen.getByRole("button", { name: "SEO working view" }));
    await user.click(screen.getByRole("button", { name: "Preview client report" }));
    const ids = Array.from(container.querySelectorAll("[id]")).map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(api).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled(); expect(push).not.toHaveBeenCalled();
  });

  it("has one final conversion button that only enters the existing business flow", async () => {
    const user = userEvent.setup(); const api = vi.spyOn(globalThis, "fetch"); render(<MethodCTA />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByText(/New accounts receive 5 permanent credits/)).toBeVisible();
    expect(screen.getByRole("link", { name: "See the full report sample first" })).toHaveAttribute("href", "/sample-report#report-scenarios");
    await user.click(screen.getByRole("button", { name: "Analyze a business" }));
    expect(push).toHaveBeenCalledExactlyOnceWith("/cases/new"); expect(api).not.toHaveBeenCalled();
  });

  it("keeps both scenario destinations available on the existing sample page", () => {
    const { container } = render(<SampleReportsV22 />);
    const nav = within(screen.getByRole("navigation", { name: "Report sample scenarios" }));
    expect(nav.getAllByRole("link")).toHaveLength(2);
    for (const link of nav.getAllByRole("link")) {
      const target = container.querySelector(link.getAttribute("href")!);
      expect(target).toBeVisible(); expect(target).toHaveClass("scroll-mt-28");
    }
    expect(container.querySelector("#report-scenarios")).toHaveClass("scroll-mt-28");
  });

  it("does not navigate or track the CTA when an unsaved-edit guard cancels it", async () => {
    const user = userEvent.setup(); render(<MethodCTA />);
    const cancel = (event: Event) => event.preventDefault();
    window.addEventListener("searchtrust:before-navigation", cancel);
    try {
      await user.click(screen.getByRole("button", { name: "Analyze a business" }));
      expect(push).not.toHaveBeenCalled(); expect(track).not.toHaveBeenCalled();
    } finally { window.removeEventListener("searchtrust:before-navigation", cancel); }
  });
});
