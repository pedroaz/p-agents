"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/pixelact-ui/button";
import { Spinner } from "@/components/ui/pixelact-ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/pixelact-ui/card";
import { useOpenCodeStore } from "@/lib/store";
import { useProjectStore } from "@/lib/store";
import "@/components/ui/pixelact-ui/styles/styles.css";

export default function OpenCode() {
  const {
    cliStatus,
    serverStatus,
    loading,
    checking,
    starting,
    stopping,
    error,
    checkStatus,
    startServer,
    stopServer,
  } = useOpenCodeStore();

  const { currentProject } = useProjectStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    checkStatus();

    intervalRef.current = setInterval(checkStatus, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkStatus]);

  const openInNewWindow = () => {
    const port = currentProject?.opencode_port || 5557;
    const url = `http://localhost:${port}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const port = currentProject?.opencode_port || 5557;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-8 gap-6">
      <span className="pixel-font text-2xl font-bold mb-4">Open Code</span>

      {currentProject && (
        <div className="pixel-font text-sm text-blue-600 mb-2">
          Current Project: {currentProject.name}
        </div>
      )}

      {error && (
        <div className="pixel-font text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>OpenCode CLI</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="pixel-font font-bold">Status:</span>
              <span className={`pixel-font ${cliStatus?.available ? "text-green-600" : "text-red-600"}`}>
                {cliStatus?.available ? "Available" : "Not Available"}
              </span>
            </div>

            {cliStatus?.version && (
              <div className="flex items-center justify-between">
                <span className="pixel-font font-bold">Version:</span>
                <span className="pixel-font">{cliStatus.version}</span>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <Button onClick={checkStatus} disabled={checking} variant="secondary">
              {checking ? "Checking..." : "Refresh Status"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Web Server (Port {port})</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="pixel-font font-bold">Status:</span>
              <span className={`pixel-font ${serverStatus?.running ? "text-green-600" : "text-red-600"}`}>
                {serverStatus?.running ? "Running" : "Not Running"}
              </span>
            </div>

            {serverStatus?.pid && (
              <div className="flex items-center justify-between">
                <span className="pixel-font font-bold">PID:</span>
                <span className="pixel-font">{serverStatus.pid}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="pixel-font font-bold">URL:</span>
              <span className="pixel-font text-xs">http://localhost:{port}</span>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            {serverStatus?.running ? (
              <>
                <Button onClick={openInNewWindow} variant="default">
                  Open OpenCode Web Interface
                </Button>
                <Button onClick={stopServer} disabled={stopping} variant="destructive">
                  {stopping ? "Stopping..." : "Stop Server"}
                </Button>
              </>
            ) : (
              <Button onClick={startServer} disabled={starting} variant="success">
                {starting ? "Starting..." : "Start Server"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {!cliStatus?.available && (
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Not Installed</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="pixel-font text-sm text-gray-600">
              OpenCode is not installed. Install it with:
            </p>
            <code className="pixel-font block mt-2 p-2 bg-gray-100 rounded text-sm">
              npm install -g opencode
            </code>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
