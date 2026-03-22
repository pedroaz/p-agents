"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/pixelact-ui/button";
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
} from "@/components/ui/pixelact-ui/menubar";

const API_BASE = "http://localhost:5556";

interface GitStatus {
  working_dir: string;
  current_branch: string;
  uncommitted_files: number;
  has_changes: boolean;
}

export function Navigation() {
  const pathname = usePathname();
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/git/status`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setGitStatus(data);
      })
      .catch(() => {});
  }, []);

  const handleReset = async () => {
    if (
      !confirm("Reset branch to main and discard all changes? This cannot be undone.")
    ) {
      return;
    }
    setResetting(true);
    try {
      const response = await fetch(`${API_BASE}/git/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discard: true, base: "main" }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setGitStatus((prev) =>
            prev
              ? {
                  ...prev,
                  current_branch: data.branch,
                  uncommitted_files: 0,
                  has_changes: false,
                }
              : null
          );
        } else {
          alert("Reset failed: " + (data.errors?.join(", ") || "Unknown error"));
        }
      }
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="pixel__nav border-b-2 border-black bg-white px-4 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/">
            <h1 className="pixel-font text-xl font-bold text-black cursor-pointer">
              P-Agents
            </h1>
          </Link>

          {gitStatus && (
            <div className="flex items-center gap-2 pixel-font text-sm">
              <span className="font-bold">Branch:</span>
              <span
                className={
                  gitStatus.has_changes ? "text-orange-600" : "text-green-600"
                }
              >
                {gitStatus.current_branch}
              </span>
              {gitStatus.uncommitted_files > 0 && (
                <span className="text-red-600">
                  ({gitStatus.uncommitted_files} uncommitted)
                </span>
              )}
              <Button
                onClick={handleReset}
                disabled={resetting}
                variant="destructive"
                size="sm"
              >
                {resetting ? "Resetting..." : "Reset"}
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Menubar>
            <MenubarMenu>
              <MenubarTrigger>Tasks</MenubarTrigger>
              <MenubarContent>
                <Link href="/task-management">
                  <MenubarItem>Task Management</MenubarItem>
                </Link>
                <Link href="/open-code">
                  <MenubarItem>Open Code</MenubarItem>
                </Link>
                <Link href="/git">
                  <MenubarItem>Git</MenubarItem>
                </Link>
              </MenubarContent>
            </MenubarMenu>

            <MenubarMenu>
              <MenubarTrigger>Apps</MenubarTrigger>
              <MenubarContent>
                <Link href="/application">
                  <MenubarItem>Application</MenubarItem>
                </Link>
                <Link href="/jira">
                  <MenubarItem>Jira</MenubarItem>
                </Link>
                <Link href="/docker">
                  <MenubarItem>Docker</MenubarItem>
                </Link>
              </MenubarContent>
            </MenubarMenu>
          </Menubar>
          <Link href="/configuration">
            <Button variant={pathname === "/configuration" ? "default" : "secondary"} size="sm">
              Configuration
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}