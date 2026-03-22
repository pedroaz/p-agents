"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/pixelact-ui/button";

const navItems = [
  { href: "/task-management", label: "Task Management" },
  { href: "/open-code", label: "Open Code" },
  { href: "/vs-code", label: "VS Code" },
  { href: "/jira-docker", label: "Jira Docker" },
  { href: "/configuration", label: "Configuration" },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="pixel__nav border-b-2 border-black bg-white px-4 py-2">
      <div className="flex items-center justify-between">
        <Link href="/">
          <h1 className="pixel-font text-xl font-bold text-black cursor-pointer">P-Agents</h1>
        </Link>
        <div className="flex gap-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant={pathname === item.href ? "default" : "secondary"}
                size="sm"
              >
                {item.label}
              </Button>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}