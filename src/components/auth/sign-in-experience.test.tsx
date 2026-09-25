import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SignInExperience } from "./sign-in-experience";

describe("SignInExperience", () => {
  it("explains the Case journey and credit boundary around the secure auth panel", () => {
    const html = renderToStaticMarkup(<SignInExperience authPanel={<div>Secure authentication form</div>} />);

    expect(html).toContain("Bring one business. Leave with a defensible next move.");
    expect(html).toContain("Start a client Case");
    expect(html).toContain("Verify with client data");
    expect(html).toContain("5 permanent credits");
    expect(html).toContain("Case setup, site check, business identity and service/market confirmation");
    expect(html).toContain("Competitor discovery plus a complete Prospect Analysis");
    expect(html).toContain("Secure authentication form");
  });
});
