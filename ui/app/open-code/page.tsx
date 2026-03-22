"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/pixelact-ui/button";
import { Spinner } from "@/components/ui/pixelact-ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/pixelact-ui/card";

interface ServerStatus {
  running: boolean;
  pid: number | null;
  port: number;
  has_auth: boolean;
  username: string;
}

interface CliStatus {
  available: boolean;
  version: string | null;
}

const API_BASE = "http://localhost:5556";
const OPENCODE_URL = "http://localhost:5557";

export default function OpenCode() {
  const [cliStatus, setCliStatus] = useState<CliStatus | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkStatus = async () => {
    setChecking(true);
    setError(null);
    try {
      const [cliResponse, serverResponse] = await Promise.all([
        fetch(`${API_BASE}/configuration`),
        fetch(`${API_BASE}/opencode/status`)
      ]);

      if (cliResponse.ok) {
        const data = await cliResponse.json();
        setCliStatus({
          available: data.opencode?.available || false,
          version: data.opencode?.version || null
        });
      }

      if (serverResponse.ok) {
        const serverData = await serverResponse.json();
        setServerStatus(serverData);
      }
    } catch (err) {
      setError("Failed to check status");
      setCliStatus({ available: false, version: null });
      setServerStatus({ running: false, pid: null, port: 5557, has_auth: false, username: "opencode" });
    } finally {
      setLoading(false);
      setChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();

    intervalRef.current = setInterval(checkStatus, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const openInNewWindow = () => {
    window.open(OPENCODE_URL, "_blank", "noopener,noreferrer");
  };

  const startServer = async () => {
    setStarting(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/opencode/start`, { method: "POST" });
      if (response.ok) {
        await checkStatus();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to start server");
      }
    } catch {
      setError("Failed to start server");
    } finally {
      setStarting(false);
    }
  };

  const stopServer = async () => {
    setStopping(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/opencode/stop`, { method: "POST" });
      if (response.ok) {
        await checkStatus();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to stop server");
      }
    } catch {
      setError("Failed to stop server");
    } finally {
      setStopping(false);
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
      <span className="pixel-font text-2xl font-bold mb-4">Open Code</span>

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
          <CardTitle>Web Server (Port 5557)</CardTitle>
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

            {serverStatus?.running && serverStatus?.has_auth && (
              <div className="flex items-center justify-between">
                <span className="pixel-font font-bold">Username:</span>
                <span className="pixel-font">{serverStatus.username}</span>
              </div>
            )}

            {serverStatus?.running && serverStatus?.has_auth && (
              <div className="pixel-font text-xs text-gray-500 mt-2">
                Login with username "{serverStatus.username}" and your password
              </div>
            )}
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