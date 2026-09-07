import {
  LayoutDashboard,
  Users,
  Wallet,
  Receipt,
  CreditCard,
  Image,
  Sparkles,
  Star,
  Folder,
  Bell,
  Smartphone,
  BarChart3,
  ListTodo,
  Webhook,
  KeyRound,
  SlidersHorizontal,
} from "lucide-react";

export const NAV = [
  { group: "Overview", items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    group: "Management",
    items: [
      { href: "/users", label: "Users", icon: Users },
      { href: "/credits", label: "Credits & Wallet", icon: Wallet },
      { href: "/transactions", label: "Transactions", icon: Receipt },
      { href: "/subscriptions", label: "Subscriptions", icon: CreditCard },
    ],
  },
  {
    group: "AI & Content",
    items: [
      { href: "/headshots", label: "Headshots", icon: Image },
      { href: "/branding", label: "Branding Analysis", icon: Sparkles },
      { href: "/reviews", label: "Profile Reviews", icon: Star },
      { href: "/projects", label: "Projects / Library", icon: Folder },
    ],
  },
  {
    group: "Operations",
    items: [
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/fcm", label: "FCM Management", icon: Smartphone },
      { href: "/ai-usage", label: "AI Usage", icon: BarChart3 },
      { href: "/jobs", label: "AI Jobs", icon: ListTodo },
      { href: "/webhooks", label: "Webhooks", icon: Webhook },
      { href: "/api-keys", label: "API Keys", icon: KeyRound },
      { href: "/remote-config", label: "Remote Config", icon: SlidersHorizontal },
    ],
  },
];

export function isActive(path: string, href: string) {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

export function crumbs(path: string): string[] {
  if (path === "/") return ["Dashboard", "Overview"];
  if (path.startsWith("/users/")) return ["Management", "Users", "Detail"];
  if (path.startsWith("/headshots/")) return ["AI & Content", "Headshots", "Job"];
  const map: Record<string, string[]> = {
    "/users": ["Management", "Users"],
    "/credits": ["Management", "Credits & Wallet"],
    "/transactions": ["Management", "Transactions"],
    "/subscriptions": ["Management", "Subscriptions"],
    "/headshots": ["AI & Content", "Headshots"],
    "/branding": ["AI & Content", "Branding Analysis"],
    "/reviews": ["AI & Content", "Profile Reviews"],
    "/projects": ["AI & Content", "Projects / Library"],
    "/notifications": ["Operations", "Notifications"],
    "/fcm": ["Operations", "FCM Management"],
    "/ai-usage": ["Operations", "AI Usage"],
    "/jobs": ["Operations", "AI Jobs"],
    "/webhooks": ["Operations", "Webhooks"],
    "/api-keys": ["AI & Access", "API Keys"],
    "/remote-config": ["Operations", "Remote Config"],
  };
  return map[path] ?? [path];
}
