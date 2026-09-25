import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NewCaseStepper } from "./new-case-stepper";

describe("NewCaseStepper", () => {
  it("names each decision by the outcome the SEO is confirming", () => {
    const html = renderToStaticMarkup(<NewCaseStepper stage="goal_website" />);

    expect(html).toContain("Scope");
    expect(html).toContain("Confirm the public identity");
    expect(html).toContain("Confirm at least 1 real rival");
    expect(html).toContain("Review what analysis can support");
  });
});
