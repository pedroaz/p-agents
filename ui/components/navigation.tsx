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
} from "@/components/ui/pixelact-ui/menubar";
import { useGitStore } from "@/lib/store";

export function Navigation() {
  const pathname = usePathname();
  const { status, fetchStatus, handleReset } = useGitStore();
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const onReset = async () => {
    if (
      !confirm("Reset branch to main and discard all changes? This cannot be undone.")
    ) {
      return;
    }
    setResetting(true);
    try {
      await handleReset();
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
        </div>

        {status && (
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 pixel-font text-sm">
            <span className="font-bold">Branch:</span>
            <span
              className={
                status.has_changes ? "text-orange-600" : "text-green-600"
              }
            >
              {status.current_branch}
            </span>
            {status.uncommitted_files > 0 && (
              <span className="text-red-600">
                ({status.uncommitted_files} uncommitted)
              </span>
            )}
            <Button
              onClick={onReset}
              disabled={resetting}
              variant="destructive"
              size="sm"
            >
              {resetting ? "Resetting..." : "Reset"}
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Menubar>
            <MenubarMenu>
              <MenubarTrigger>Tasks</MenubarTrigger>
              <MenubarContent>
                <Link href="/task-management">
                  <MenubarItem>Task Management</MenubarItem>
                </Link>
                <Link href="/git">
                  <MenubarItem>Git</MenubarItem>
                </Link>
                <Link href="/application">
                  <MenubarItem>Application</MenubarItem>
                </Link>
              </MenubarContent>
            </MenubarMenu>

            <MenubarMenu>
              <MenubarTrigger>Apps</MenubarTrigger>
              <MenubarContent>
                <Link href="/open-code">
                  <MenubarItem>Open Code</MenubarItem>
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