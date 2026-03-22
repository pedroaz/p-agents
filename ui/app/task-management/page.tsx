"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/pixelact-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/pixelact-ui/card";
import { Input } from "@/components/ui/pixelact-ui/input";
import { Spinner } from "@/components/ui/pixelact-ui/spinner";
import { cn } from "@/lib/utils";
import "@/components/ui/pixelact-ui/styles/styles.css";

interface Task {
  id: string;
  description: string;
  agent: string;
  source: string;
  jira_ticket: string;
  created_at: string;
}

interface Config {
  opencode_working_folder: string;
  jira_token: { set: boolean };
}

const API_BASE = "http://localhost:5556";

export default function TaskManagement() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [agents, setAgents] = useState<string[]>([]);
  const [status, setStatus] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const [newTask, setNewTask] = useState({
    description: "",
    agent: "",
  });

  const fetchTasks = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/tasks`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/configuration`);
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        if (data.opencode_working_folder) {
          fetchAgents(data.opencode_working_folder);
        }
      }
    } catch {
    }
  }, []);

  const fetchAgents = useCallback(async (dir: string) => {
    try {
      const response = await fetch(`${API_BASE}/agents?dir=${encodeURIComponent(dir)}`);
      if (response.ok) {
        const data = await response.json();
        setAgents(data.agents);
      }
    } catch {
      setAgents([]);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchConfig();
  }, [fetchTasks, fetchConfig]);

  const showStatus = (msg: string, type: "success" | "error") => {
    setStatus({ msg, type });
    setTimeout(() => setStatus(null), 3000);
  };

  const createTask = async () => {
    if (!newTask.description) {
      showStatus("Description is required", "error");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch(`${API_BASE}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTask),
      });

      if (response.ok) {
        showStatus("Task created!", "success");
        setNewTask({ description: "", agent: "" });
        fetchTasks();
      } else {
        showStatus("Failed to create task", "error");
      }
    } catch {
      showStatus("Failed to create task", "error");
    } finally {
      setCreating(false);
    }
  };

  const executeTask = async (taskId: string) => {
    setExecuting(taskId);
    try {
      const response = await fetch(`${API_BASE}/tasks/${taskId}/execute`, {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        showStatus(`Task started! Session: ${data.session_id}`, "success");
      } else {
        const error = await response.json();
        showStatus(error.error || "Failed to execute task", "error");
      }
    } catch {
      showStatus("Failed to execute task", "error");
    } finally {
      setExecuting(null);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        showStatus("Task deleted!", "success");
        fetchTasks();
      } else {
        showStatus("Failed to delete task", "error");
      }
    } catch {
      showStatus("Failed to delete task", "error");
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
      <div className="pixel-font text-2xl font-bold">Task Management</div>

      {status && (
        <div className={cn(
          "pixel-font text-sm p-2 rounded",
          status.type === "success" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
        )}>
          {status.msg}
        </div>
      )}

      {config?.opencode_working_folder ? (
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Create New Task</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <label className="pixel-font text-sm font-bold block mb-1">Description *</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="What should the agent do?"
                  className="w-full p-2 border rounded pixel-font text-sm min-h-[100px]"
                />
              </div>

              {agents.length > 0 && (
                <div>
                  <label className="pixel-font text-sm font-bold block mb-1">
                    Agent {newTask.agent && <span className="text-green-600">({newTask.agent})</span>}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {agents.map((agent) => (
                      <Button
                        key={agent}
                        size="sm"
                        variant={newTask.agent === agent ? "default" : "secondary"}
                        onClick={() => setNewTask({ ...newTask, agent })}
                      >
                        {agent}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={createTask}
                  disabled={creating}
                  variant="success"
                >
                  {creating ? "Creating & Running..." : "Create & Run Task"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-2xl">
          <CardContent className="p-6">
            <p className="pixel-font text-sm text-red-600">
              Please set the OpenCode working folder in Configuration first.
            </p>
          </CardContent>
        </Card>
      )}

      {tasks.length > 0 && (
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Tasks ({tasks.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {tasks.map((task) => (
                <div key={task.id} className="border p-4 rounded">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="pixel-font">{task.description}</p>
                      <div className="pixel-font text-xs text-gray-500 mt-2">
                        {task.agent && <p>Agent: {task.agent}</p>}
                        <p>Created: {new Date(task.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => executeTask(task.id)}
                        disabled={executing === task.id || !config?.opencode_working_folder}
                      >
                        {executing === task.id ? "Running..." : "Run"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteTask(task.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}