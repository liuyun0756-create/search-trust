// @vitest-environment jsdom
import {fireEvent, render, screen} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {ComparisonWindowPreview} from "./ComparisonWindowPreview";
import fixture from "@/lib/implementation-records/contracts/fixture.json";
import type {ImplementationRecord} from "@/lib/implementation-records/contracts";
const record = fixture.history[0] as ImplementationRecord;
afterEach(() => vi.unstubAllGlobals());
describe("free saved-record comparison planner", () => {
  it("shows both full windows without claiming source readiness or making requests", () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    render(<ComparisonWindowPreview record={record} actions={fixture.source.actions}/>);
    expect(screen.getByText("Dates only · no data checked")).toBeVisible();
    expect(screen.getByText("Based on saved implementation revision 1, not unsaved edits.")).toBeVisible();
    expect(screen.getByText("Before · 28 full days")).toBeVisible(); expect(screen.getByText("After · 28 full days")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Days per window"), {target: {value: "7"}});
    expect(screen.getByText("Before · 7 full days")).toBeVisible();
    fireEvent.click(screen.getByRole("button", {name: "Check calendar again · free"}));
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByText(/No collection, analysis or credit use/)).toBeVisible();
  });
  it("renders no planner when no implementation actions remain", () => {
    render(<ComparisonWindowPreview record={{...record, entries: []}} actions={fixture.source.actions}/>);
    expect(screen.queryByRole("region")).toBeNull();
  });
});
