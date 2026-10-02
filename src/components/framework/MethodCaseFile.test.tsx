// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MethodCaseFile } from "./MethodCaseFile";
import { MethodJourney } from "./MethodJourney";
import { MethodNavigation, methodChapters } from "./MethodNavigation";

describe("evolving fictional case file", () => {
  it("keeps the same case while evidence, decision and boundaries change with the stage", () => {
    render(<MethodJourney><MethodNavigation /><MethodCaseFile />{methodChapters.map((chapter) => <section data-method-stage key={chapter.id}><h2 id={chapter.id}>{chapter.label}</h2></section>)}</MethodJourney>);
    const file = within(screen.getByRole("complementary", { name: "Fictional case file as the method progresses" }));
    expect(file.getByText(/Fictional local service business/)).toBeVisible();
    expect(file.getByText(/No client analytics yet/)).toBeVisible();
    expect(file.getByText(/Check for an existing page before recommending a new one/, { selector: "dd" })).toBeVisible();

    const navigation = within(screen.getByRole("navigation", { name: "Our Method chapters" }));
    fireEvent.click(navigation.getByRole("link", { name: /Verify/ }));
    expect(file.getByText(/client confirms an existing page/)).toBeVisible();
    expect(file.getByText(/before creating a possible duplicate/, { selector: "dd" })).toBeVisible();
    expect(file.queryByText(/No client analytics yet/)).not.toBeInTheDocument();

    fireEvent.click(navigation.getAllByRole("link").find((link) => link.getAttribute("href") === "#practice-title")!);
    expect(file.getByText(/No real implementation log, post-change data or measured outcome/)).toBeVisible();
    expect(file.getByText(/No result is claimed for this fictional case/)).toBeVisible();
    expect(file.getByText(/No real client result or completed work is implied/)).toBeVisible();
  });
});
