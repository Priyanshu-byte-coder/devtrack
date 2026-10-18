/** Display names for EngineeringDomain enum values (never show "AI_ML"). */
const DOMAIN_NAMES: Record<string, string> = {
  Frontend: "Frontend",
  Backend: "Backend",
  AI_ML: "AI / ML",
  DevOps: "DevOps",
  DataScience: "Data science",
  Security: "Security",
  Mobile: "Mobile",
  Systems: "Systems",
  FullStack: "Full-stack",
};

/** Title-case label for UI ("Full-stack", "AI / ML"). */
export function domainDisplayName(domain: string): string {
  return DOMAIN_NAMES[domain] ?? domain;
}

/** Label for running prose ("full-stack", "AI/ML", "DevOps"). */
export function domainLabel(domain: string): string {
  if (domain === "AI_ML") return "AI/ML";
  if (domain === "DevOps") return "DevOps";
  return domainDisplayName(domain).toLowerCase();
}
