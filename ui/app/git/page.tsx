"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/pixelact-ui/button";
import { Spinner } from "@/components/ui/pixelact-ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/pixelact-ui/card";
import { Input } from "@/components/ui/pixelact-ui/input";
import { useGitStore } from "@/lib/store";
import "@/components/ui/pixelact-ui/styles/styles.css";

export default function Git() {
  const {
    status,
    pulls,
    branches,
    loading,
    error,
    switchBranch,
    newBranchName,
    createPrTitle,
    createPrBody,
    actionLoading,
    prSuccess,
    setSwitchBranch,
    setNewBranchName,
    setCreatePrTitle,
    setCreatePrBody,
    refreshAll,
    handleSwitchBranch,
    handleCreateBranch,
    handleCreatePr,
    handleUpdatePr,
  } = useGitStore();

  const existingPr = pulls.find(
    (pr) => pr.headRefName === status?.current_branch && pr.state === "open"
  );

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

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