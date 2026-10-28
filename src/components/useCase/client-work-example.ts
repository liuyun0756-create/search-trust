export type ExampleEvidence = {
  id: string;
  source: string;
  access: "public" | "verified";
  observation: string;
};

export type ClientWorkExample = {
  business: {
    name: string;
    city: string;
    domain: string;
    service: string;
    publicAreas: string;
    confirmedAreas: string;
  };
  page: {
    path: string;
    address: string;
    openingH1: string;
    problems: string[];
  };
  period: { label: string; days: number };
  metrics: { impressions: number; clicks: number; ctr: string };
  evidence: ExampleEvidence[];
  prospect: {
    conclusion: string;
    findings: { title: string; text: string }[];
    start: string;
    question: string;
    use: string;
  };
  verified: {
    conclusion: string;
    basis: string;
    actions: { title: string; text: string }[];
    limit: string;
    use: string;
  };
  decision: {
    finding: string;
    recommendation: string;
    practicalReason: string;
    evidenceLimit: string;
  };
  action: {
    title: string;
    goal: string;
    target: string;
    priority: string;
    role: string;
    steps: { title: string; text: string }[];
    completion: string[];
    review: { title: string; text: string }[];
  };
  deliveryCopy: {
    client: {
      title: string;
      intro: string;
      found: string;
      proposedWork: string[];
      why: string;
      review: string;
    };
    seo: {
      decision: string;
      evidence: string;
      execution: string;
      acceptance: string;
      reviewLimits: string;
    };
  };
  implementationStatus: string;
};

const business = {
  name: "Oak & Vale Cooling",
  city: "Austin, TX",
  domain: "oakvalecooling.example",
  service: "AC repair",
  publicAreas: "North Austin and Central Austin",
  confirmedAreas: "North Austin and Central Austin",
};

const page = {
  path: "/ac-repair/",
  address: `${business.domain}/ac-repair/`,
  openingH1: "Fast, reliable cooling solutions",
  problems: ["not cooling", "water leaks", "unusual noises"],
};

const period = { label: "Aug 31–Sep 27, 2026", days: 28 };
const impressions = 12_400;
const clicks = 310;
const metrics = {
  impressions,
  clicks,
  ctr: `${((clicks / impressions) * 100).toFixed(1)}%`,
};

export const clientWorkExample: ClientWorkExample = {
  business,
  page,
  period,
  metrics,
  evidence: [
    {
      id: "E01",
      source: "Page opening",
      access: "public",
      observation: `H1: “${page.openingH1}.” The opening does not explicitly name ${business.service}, the service areas or a booking route.`,
    },
    {
      id: "E02",
      source: "Page content",
      access: "public",
      observation: `“Not cooling,” “water leaks” and “unusual noises” appear later in the page, separate from the opening explanation. A separate service-area page lists ${business.publicAreas}; the client has not confirmed current coverage yet.`,
    },
    {
      id: "E03",
      source: "Contact path",
      access: "public",
      observation:
        "The phone number is in the footer. The booking form follows the main content. No direct contact action appears in the opening section.",
    },
    {
      id: "E04",
      source: "Google Search Console",
      access: "verified",
      observation: `${period.label} · This page · ${impressions.toLocaleString("en-US")} impressions · ${clicks.toLocaleString("en-US")} clicks · ${metrics.ctr} CTR.`,
    },
    {
      id: "E05",
      source: "Client confirmation",
      access: "verified",
      observation: `This is the main ${business.service} page. ${business.confirmedAreas} are currently served.`,
    },
  ],
  prospect: {
    conclusion:
      "The AC repair page exists. Its service coverage and booking route are not clear at the point of entry.",
    findings: [
      {
        title: "A broad opening.",
        text: `The page opens with “${page.openingH1}.” AC repair and the problems covered are not stated in the opening section.`,
      },
      {
        title: "Coverage takes another visit.",
        text: `${business.publicAreas} are listed on a separate service-area page, not beside the repair offer. Whether those areas are still served needs client confirmation.`,
      },
      {
        title: "Contact comes late.",
        text: "The phone number is in the footer and the booking form is below the main content. There is no direct contact action in the opening section.",
      },
    ],
    start:
      "Improve the existing page’s service explanation, coverage and contact route before proposing another repair page.",
    question: "Is AC repair a current priority, and are both areas still served?",
    use: "For a first call, a focused diagnosis and an initial scope discussion.",
  },
  verified: {
    conclusion:
      "Improve the existing AC repair page before adding another page for the same service.",
    basis: `The page recorded ${impressions.toLocaleString("en-US")} impressions and ${clicks.toLocaleString("en-US")} clicks in Google Search Console from ${period.label}. The client confirms it is the main AC repair page and that ${business.confirmedAreas} are current service areas.`,
    actions: [
      {
        title: "Clarify the opening.",
        text: "State AC repair, the confirmed service areas and the repair problems covered.",
      },
      {
        title: "Bring contact forward.",
        text: "Add a booking action and a tap-to-call link near the opening; retain the full form below.",
      },
      {
        title: "Check and review.",
        text: "Test the mobile contact path, then review comparable page-level search activity and verified contact events where available.",
      },
    ],
    limit:
      "Contact events are not qualified enquiries. These observations do not establish lost bookings or predict a ranking increase.",
    use: "For work planning, execution handoff and the next review.",
  },
  decision: {
    finding:
      "The page is receiving search clicks, but service and contact information are not presented together at the point of entry.",
    recommendation:
      "Improve the confirmed page before creating another page for the same service. Existing search visibility supports reviewing this page first; the content observations identify specific information and contact changes to make.",
    practicalReason:
      "The target is already confirmed, the gaps are located on the page, and the work does not require a new page or a site-structure change.",
    evidenceLimit:
      "It does not prove that these gaps caused lost enquiries or show how rankings will change after the work.",
  },
  action: {
    title:
      "Clarify the AC repair offer and bring booking into the opening section.",
    goal:
      "Help visitors identify the repair service, confirm the service area and find a contact route without searching through the whole page.",
    target: page.path,
    priority: "Address first",
    role: "Website editor / site maintainer",
    steps: [
      {
        title: "Make the opening specific.",
        text: `Name AC repair and the confirmed Austin coverage. Describe the repair problems covered. Do not add unconfirmed promises such as 24-hour response or same-day attendance.`,
      },
      {
        title: "Move repair details forward.",
        text: `Bring the existing “${page.problems[0]},” “${page.problems[1]}” and “${page.problems[2]}” information closer to the opening. Keep the detail relevant to the confirmed service.`,
      },
      {
        title: "Add a direct contact route.",
        text: "Use “Book AC repair” to reach the existing form. Add a tap-to-call link using the verified business number. Keep the full form and contact information below.",
      },
      {
        title: "Check the mobile path.",
        text: "Confirm that the service text is readable, the button is unobstructed, the phone link works and the form can be submitted.",
      },
    ],
    completion: [
      "AC repair and the confirmed service areas are explicit near the opening.",
      "Common repair problems can be found without reading the whole page.",
      "The booking action reaches the intended form.",
      "The phone link and form have been functionally checked.",
      "No unconfirmed service guarantees have been added.",
    ],
    review: [
      {
        title: "Implementation",
        text: "Check the live page against the completion criteria above.",
      },
      {
        title: "Search activity",
        text: "Compare page-level impressions, clicks and CTR over suitable, comparable windows.",
      },
      {
        title: "Contact behavior",
        text: "Review verified contact events where available; phone clicks are not completed calls and submissions are not qualified leads.",
      },
      {
        title: "Next decision",
        text: "Consider sample size, concurrent changes and client feedback before retaining or changing the plan.",
      },
    ],
  },
  deliveryCopy: {
    client: {
      title: "Make the existing repair page easier to understand and act on.",
      intro: `Your AC repair page recorded ${clicks.toLocaleString("en-US")} Google Search clicks from ${period.label}. We recommend improving this page before adding another page for the same service.`,
      found:
        "The page explains the repair service, but visitors need to look further down to find specific repair problems and the booking form. Service coverage is not stated beside the main offer.",
      proposedWork: [
        "State the repair service and confirmed coverage in the opening section.",
        "Bring common repair problems into a more visible position.",
        "Add a clear booking and phone route, then test it on mobile.",
      ],
      why:
        "These changes address identified information and contact gaps on a page already receiving search clicks. They do not depend on creating another page first.",
      review:
        "First, check that the agreed page and contact changes work as intended. Then review comparable search activity and verified contact events where available. Whether qualified enquiries improve requires follow-up evidence and actual enquiry records.",
    },
    seo: {
      decision: `Improve ${page.path}; defer a duplicate service page pending a distinct need.`,
      evidence:
        "E01–E03 locate the content/contact gaps. E04 records page-level search activity. E05 confirms page purpose and current coverage.",
      execution:
        "Opening specificity, repair details, booking/call route and mobile checks as defined in Action 01.",
      acceptance:
        "Clear service/coverage, working contact path, no unconfirmed claims.",
      reviewLimits:
        "No implementation or post-change outcome is recorded here. Contact events require validation and do not represent qualified enquiries.",
    },
  },
  implementationStatus: "Proposed · Not yet implemented",
};

export function formatBaseline(example: ClientWorkExample) {
  return `${example.period.label} · ${example.metrics.impressions.toLocaleString("en-US")} impressions · ${example.metrics.clicks.toLocaleString("en-US")} clicks · ${example.metrics.ctr} CTR`;
}
