export const marketingPages = [
  { page: "produs", href: "/produs", label: "Produs" },
  { page: "functionalitati", href: "/functionalitati", label: "Funcționalități" },
  { page: "cum-functioneaza", href: "/cum-functioneaza", label: "Cum funcționează" },
  { page: "pret", href: "/pret", label: "Preț" },
  { page: "faq", href: "/faq", label: "FAQ" },
  { page: "prezentare", href: "/prezentare", label: "Prezentare" },
] as const;

export type MarketingPage = "home" | typeof marketingPages[number]["page"];
