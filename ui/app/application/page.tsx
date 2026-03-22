"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/pixelact-ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/pixelact-ui/card";
import { Input } from "@/components/ui/pixelact-ui/input";
import { Spinner } from "@/components/ui/pixelact-ui/spinner";
import { cn } from "@/lib/utils";
import "@/components/ui/pixelact-ui/styles/styles.css";

interface ApplicationConfig {
  start_commands: string[];
  kill_command: string;
  ui_url: string;
  working_folder: string;
}

interface Process {
  id: string;
  pid: number;
  command: string;
  log_file: string;
  started_at: string;
  running: boolean;
}

const API_BASE = "http://localhost:5556";

export default function Application() {
  const [config, setConfig] = useState<ApplicationConfig>({
    start_commands: [],
    kill_command: "",
    ui_url: "",
    working_folder: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [killing, setKilling] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<"success" | "error" | null>(null);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [logs, setLogs] = useState<string>("");
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [fetchingLogs, setFetchingLogs] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/application`);
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProcesses = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/application/processes`);
      if (response.ok) {
        const data = await response.json();
        setProcesses(data.processes);
      }
    } catch {
    }
  }, []);

  const fetchLogs = useCallback(async (sessionId: string) => {
    setFetchingLogs(true);
    try {
      const response = await fetch(`${API_BASE}/application/logs/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || "");
      }
    } catch {
    } finally {
      setFetchingLogs(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchProcesses();
  }, [fetchConfig, fetchProcesses]);

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

  const showStatus = (message: string, type: "success" | "error") => {
    setStatus(message);
    setStatusType(type);
    setTimeout(() => {
      setStatus(null);
      setStatusType(null);
    }, 3000);
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/application`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (response.ok) {
        showStatus("Configuration saved!", "success");
      } else {
        showStatus("Failed to save configuration", "error");
      }
    } catch {
      showStatus("Failed to save configuration", "error");
    } finally {
      setSaving(false);
    }
  };

  const startApplication = async () => {
    setStarting(true);
    setStatus(null);
    try {
      const response = await fetch(`${API_BASE}/application/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        const data = await response.json();
        showStatus("Application started!", "success");
        fetchProcesses();
        if (data.session_id) {
          setSelectedSession(data.session_id);
        }
      } else {
        const error = await response.json();
        showStatus(error.error || "Failed to start application", "error");
      }
    } catch {
      showStatus("Failed to start application", "error");
    } finally {
      setStarting(false);
    }
  };

  const killApplication = async () => {
    setKilling(true);
    setStatus(null);
    try {
      const response = await fetch(`${API_BASE}/application/kill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        showStatus("Application killed!", "success");
        fetchProcesses();
        setLogs("");
        setSelectedSession(null);
      } else {
        showStatus("Failed to kill application", "error");
      }
    } catch {
      showStatus("Failed to kill application", "error");
    } finally {
      setKilling(false);
    }
  };

  const updateStartCommand = (index: number, value: string) => {
    const newCommands = [...config.start_commands];
    newCommands[index] = value;
    setConfig({ ...config, start_commands: newCommands });
  };

  const addStartCommand = () => {
    setConfig({ ...config, start_commands: [...config.start_commands, ""] });
  };

  const removeStartCommand = (index: number) => {
    const newCommands = config.start_commands.filter((_, i) => i !== index);
    setConfig({ ...config, start_commands: newCommands });
  };

  const activeProcesses = processes.filter((p) => p.running);

  return (
    <div className="flex flex-col items-center p-8 gap-6">
      <div className="pixel-font text-2xl font-bold">Application</div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle>Application Configuration</CardTitle>
              <CardDescription>
                Configure commands to start the application, kill all processes, and the UI path
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                <div>
                  <label className="pixel-font font-bold block mb-2">
                    Start Commands
                  </label>
                  <div className="space-y-2">
                    {config.start_commands.length === 0 ? (
                      <Button onClick={addStartCommand} variant="secondary" size="sm">
                        Add Command
                      </Button>
                    ) : (
                      <>
                        {config.start_commands.map((cmd, index) => (
                          <div key={index} className="flex gap-2">
                            <Input
                              value={cmd}
                              onChange={(e) => updateStartCommand(index, e.target.value)}
                              placeholder={`Command ${index + 1}`}
                              className="flex-1"
                            />
                            {config.start_commands.length > 1 && (
                              <Button
                                onClick={() => removeStartCommand(index)}
                                variant="destructive"
                                size="sm"
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button onClick={addStartCommand} variant="secondary" size="sm">
                          Add Command
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <label className="pixel-font font-bold block mb-2">
                    Kill Command
                  </label>
                  <Input
                    value={config.kill_command}
                    onChange={(e) => setConfig({ ...config, kill_command: e.target.value })}
                    placeholder="pkill -f 'process name' or killall ProcessName"
                  />
                </div>

                <div>
                  <label className="pixel-font font-bold block mb-2">
                    Working Folder
                  </label>
                  <Input
                    value={config.working_folder}
                    onChange={(e) => setConfig({ ...config, working_folder: e.target.value })}
                    placeholder="/path/to/application/folder"
                  />
                </div>

                <div>
                  <label className="pixel-font font-bold block mb-2">
                    UI URL
                  </label>
                  <Input
                    value={config.ui_url}
                    onChange={(e) => setConfig({ ...config, ui_url: e.target.value })}
                    placeholder="http://localhost:3000"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={saveConfig} disabled={saving} variant="default">
                    {saving ? "Saving..." : "Save Configuration"}
                  </Button>
                </div>

                {status && (
                  <p
                    className={cn(
                      "pixel-font text-sm",
                      statusType === "success" ? "text-green-600" : "text-red-600"
                    )}
                  >
                    {status}
                  </p>
                )}
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
                {config.ui_url && (
                  <Button
                    onClick={() => window.open(config.ui_url, "_blank", "noopener,noreferrer")}
                    variant="default"
                  >
                    Open UI
                  </Button>
                )}
              </div>
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
        </>
      )}
    </div>
  );
}