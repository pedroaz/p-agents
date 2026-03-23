"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/pixelact-ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/pixelact-ui/card";
import { Spinner } from "@/components/ui/pixelact-ui/spinner";
import { cn } from "@/lib/utils";
import { useConfiguration } from "@/lib/configuration-context";
import { useApplicationStore } from "@/lib/store";
import "@/components/ui/pixelact-ui/styles/styles.css";

export default function Application() {
  const { configuration } = useConfiguration();
  const {
    starting,
    killing,
    status,
    statusType,
    processes,
    logs,
    selectedSession,
    fetchingLogs,
    fetchProcesses,
    fetchLogs,
    startApplication,
    killApplication,
    setSelectedSession,
  } = useApplicationStore();

  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchProcesses();
  }, [fetchProcesses]);

  useEffect(() => {
    if (selectedSession) {
      fetchLogs(selectedSession);
    }
  }, [selectedSession, fetchLogs]);

  useEffect(() => {
    pollIntervalRef.current = setInterval(() => {
      fetchProcesses();
      if (selectedSession) {
        fetchLogs(selectedSession);
      }
    }, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchProcesses, fetchLogs, selectedSession]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const appConfig = configuration?.application;
  const uiUrl = appConfig?.ui_url || "";

  return (
    <div className="flex flex-col items-center p-8 gap-6">
      <div className="pixel-font text-2xl font-bold">Application</div>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Current Configuration</CardTitle>
          <CardDescription>
            View your application settings. Configure in the Configuration page.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-3 pixel-font text-sm">
            <div>
              <span className="font-bold">Working Directory:</span>{" "}
              {appConfig?.working_folder || "Not set"}
            </div>
            <div>
              <span className="font-bold">Start Commands:</span>
              {appConfig?.start_commands && appConfig.start_commands.length > 0 ? (
                <ul className="ml-4 list-disc">
                  {appConfig.start_commands.map((cmd, i) => (
                    <li key={i} className="font-mono text-xs">{cmd || "(empty)"}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-gray-500"> None configured</span>
              )}
            </div>
            <div>
              <span className="font-bold">Kill Command:</span>{" "}
              {appConfig?.kill_command || "Not set"}
            </div>
            <div>
              <span className="font-bold">UI URL:</span>{" "}
              {uiUrl || "Not set"}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col gap-2">
            <Button
              onClick={startApplication}
              disabled={starting}
              variant="success"
            >
              {starting ? "Starting..." : "Start Application"}
            </Button>
            <Button
              onClick={killApplication}
              disabled={killing}
              variant="destructive"
            >
              {killing ? "Killing..." : "Kill Application"}
            </Button>
            {uiUrl && (
              <Button
                onClick={() => window.open(uiUrl, "_blank", "noopener,noreferrer")}
                variant="default"
              >
                Open UI
              </Button>
            )}
          </div>

          {status && (
            <p
              className={cn(
                "pixel-font text-sm mt-4",
                statusType === "success" ? "text-green-600" : "text-red-600"
              )}
            >
              {status}
            </p>
          )}
        </CardContent>
      </Card>

      {processes.length > 0 && (
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Running Processes</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-2">
              {processes.map((proc) => (
                <div
                  key={proc.id}
                  className={cn(
                    "flex items-center justify-between p-2 rounded border",
                    proc.running ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"
                  )}
                >
                  <div className="flex-1">
                    <p className="text-sm font-mono">{proc.command}</p>
                    <p className="text-xs text-gray-500">
                      PID: {proc.pid} | Started: {new Date(proc.started_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSelectedSession(proc.log_file.split("/").pop()?.replace(".log", "") || null)}
                    >
                      View Logs
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedSession && (
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Logs - {selectedSession}</CardTitle>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => fetchLogs(selectedSession)}
              >
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="bg-black text-green-400 p-4 rounded-md max-h-96 overflow-auto font-mono text-xs">
              {fetchingLogs ? (
                <div className="flex justify-center">
                  <Spinner size="sm" />
                </div>
              ) : logs ? (
                <pre className="whitespace-pre-wrap">{logs}</pre>
              ) : (
                <span className="text-gray-500">No logs available</span>
              )}
              <div ref={logsEndRef} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}