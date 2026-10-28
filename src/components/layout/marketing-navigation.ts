export const marketingNavigation = [
  { id: "home", href: "/", label: "Home" },
  { id: "framework", href: "/framework", label: "Method" },
  { id: "report", href: "/sample-report", label: "Sample Reports" },
  { id: "use-cases", href: "/use-cases", label: "Client Scenarios" },
  { id: "pricing", href: "/pricing", label: "Pricing" },
] as const;

export const marketingProductLinks = marketingNavigation.filter(
  (link) => link.id !== "home",
);
