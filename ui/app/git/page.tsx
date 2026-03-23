"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/pixelact-ui/button";
import { Spinner } from "@/components/ui/pixelact-ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/pixelact-ui/card";
import { Input } from "@/components/ui/pixelact-ui/input";

interface GitStatus {
  working_dir: string;
  current_branch: string;
  uncommitted_files: number;
  has_changes: boolean;
}

interface PullRequest {
  number: number;
  title: string;
  state: string;
  url: string;
  headRefName: string;
}

const API_BASE = "http://localhost:5556";

export default function Git() {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [pulls, setPulls] = useState<PullRequest[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [switchBranch, setSwitchBranch] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [createPrTitle, setCreatePrTitle] = useState("");
  const [createPrBody, setCreatePrBody] = useState("");

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [prSuccess, setPrSuccess] = useState<string | null>(null);

  const existingPr = pulls.find(
    (pr) => pr.headRefName === status?.current_branch && pr.state === "open"
  );

  const fetchStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/git/status`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to fetch git status");
      }
    } catch {
      setError("Failed to connect to server");
    }
  };

  const fetchPulls = async () => {
    try {
      const response = await fetch(`${API_BASE}/git/pulls`);
      if (response.ok) {
        const data = await response.json();
        setPulls(data.pulls || []);
      }
    } catch {
      // Silently fail
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await fetch(`${API_BASE}/git/branches`);
      if (response.ok) {
        const data = await response.json();
        setBranches(data.branches || []);
      }
    } catch {
      // Silently fail
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    setError(null);
    await fetchStatus();
    await fetchPulls();
    await fetchBranches();
    setLoading(false);
  };

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSwitchBranch = async () => {
    if (!switchBranch) return;
    setActionLoading("switch");
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_BASE}/git/switch-branch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: switchBranch }),
      });
      if (response.ok) {
        setSwitchBranch("");
        await refreshAll();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to switch branch");
      }
    } catch {
      setError("Failed to switch branch");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName) return;
    setActionLoading("create-branch");
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_BASE}/git/create-branch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBranchName }),
      });
      if (response.ok) {
        setNewBranchName("");
        await refreshAll();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create branch");
      }
    } catch {
      setError("Failed to create branch");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreatePr = async () => {
    if (!createPrTitle) return;
    setActionLoading("create-pr");
    setError(null);
    setSuccess(null);
    setPrSuccess(null);
    try {
      const response = await fetch(`${API_BASE}/git/create-pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: createPrTitle, body: createPrBody }),
      });
      if (response.ok) {
        const data = await response.json();
        setCreatePrTitle("");
        setCreatePrBody("");
        setPrSuccess(data.url);
        await fetchPulls();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create PR");
      }
    } catch {
      setError("Failed to create PR");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdatePr = async () => {
    setActionLoading("update-pr");
    setError(null);
    setSuccess(null);
    setPrSuccess(null);
    try {
      const response = await fetch(`${API_BASE}/git/push`, {
        method: "POST",
      });
      if (response.ok) {
        setPrSuccess("Branch pushed successfully");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to push");
      }
    } catch {
      setError("Failed to push");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-8 gap-6">
      <span className="pixel-font text-2xl font-bold mb-4">Git</span>

      {error && (
        <div className="pixel-font text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="pixel-font text-sm text-green-600 bg-green-50 p-2 rounded">
          {success}
        </div>
      )}

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Current Status</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="pixel-font font-bold">Branch:</span>
              <span className="pixel-font">{status?.current_branch || "unknown"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="pixel-font font-bold">Uncommitted Files:</span>
              <span className="pixel-font">{status?.uncommitted_files || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="pixel-font font-bold">Open PRs:</span>
              <span className="pixel-font">{pulls.length}</span>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <Button onClick={refreshAll} variant="secondary">
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Switch Branch</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col gap-3">
            <select
              className="pixel-font p-2 border rounded"
              value={switchBranch}
              onChange={(e) => setSwitchBranch(e.target.value)}
            >
              <option value="">Select branch...</option>
              {branches.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
            <Button
              onClick={handleSwitchBranch}
              disabled={!switchBranch || actionLoading === "switch"}
              variant="default"
            >
              {actionLoading === "switch" ? "Switching..." : "Switch"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Branch</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col gap-3">
            <Input
              placeholder="Branch name"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
            />
            <Button
              onClick={handleCreateBranch}
              disabled={!newBranchName || actionLoading === "create-branch"}
              variant="success"
            >
              {actionLoading === "create-branch" ? "Creating..." : "Create Branch"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{existingPr ? "Update Pull Request" : "Create Pull Request"}</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col gap-3">
            {existingPr ? (
              <>
                <p className="pixel-font text-sm text-gray-600">
                  Branch <span className="font-mono">{status?.current_branch}</span> has an open PR:
                </p>
                <a
                  href={existingPr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pixel-font text-blue-600 hover:underline"
                >
                  #{existingPr.number} {existingPr.title}
                </a>
                {!status?.has_changes ? (
                  <p className="pixel-font text-sm text-gray-500">Nothing to push</p>
                ) : (
                  <Button
                    onClick={handleUpdatePr}
                    disabled={actionLoading === "update-pr"}
                    variant="success"
                  >
                    {actionLoading === "update-pr" ? "Pushing..." : "Update PR"}
                  </Button>
                )}
              </>
            ) : (
              <>
                {status?.current_branch === "main" ? (
                  <p className="pixel-font text-sm text-red-500">
                    Cannot create PR from main branch. Switch to a feature branch.
                  </p>
                ) : !status?.has_changes ? (
                  <p className="pixel-font text-sm text-gray-500">
                    No changes to commit. Make some changes first.
                  </p>
                ) : (
                  <>
                    <Input
                      placeholder="PR Title"
                      value={createPrTitle}
                      onChange={(e) => setCreatePrTitle(e.target.value)}
                    />
                    <textarea
                      className="pixel-font p-2 border rounded"
                      placeholder="PR Body (optional)"
                      value={createPrBody}
                      onChange={(e) => setCreatePrBody(e.target.value)}
                      rows={3}
                    />
                    <Button
                      onClick={handleCreatePr}
                      disabled={!createPrTitle || actionLoading === "create-pr"}
                      variant="success"
                    >
                      {actionLoading === "create-pr" ? "Creating..." : "Create PR"}
                    </Button>
                  </>
                )}
              </>
            )}
            {prSuccess && (
              <div className="pixel-font text-sm text-green-600 bg-green-50 p-2 rounded">
                {prSuccess.startsWith("http") ? (
                  <>PR created: <a href={prSuccess} target="_blank" rel="noopener noreferrer" className="underline">{prSuccess}</a></>
                ) : (
                  prSuccess
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Open Pull Requests ({pulls.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {pulls.length === 0 ? (
            <p className="pixel-font text-gray-500">No open pull requests</p>
          ) : (
            <div className="space-y-3">
              {pulls.map((pr) => (
                <div key={pr.number} className="border-b pb-3 last:border-b-0">
                  <a
                    href={pr.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pixel-font text-blue-600 hover:underline"
                  >
                    #{pr.number} {pr.title}
                  </a>
                  <p className="pixel-font text-xs text-gray-500">
                    {pr.headRefName} → {pr.state}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}