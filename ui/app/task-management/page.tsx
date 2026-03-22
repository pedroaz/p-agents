"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/pixelact-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/pixelact-ui/card";
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
  status: string;
  session_id: string | null;
}

interface TaskStatus {
  task_id: string;
  status: string;
  session_id: string | null;
  session_url: string | null;
  session_info: any;
}

interface Config {
  opencode_working_folder: string;
  jira_token: { set: boolean };
}

const API_BASE = "http://localhost:5556";

export default function TaskManagement() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskStatuses, setTaskStatuses] = useState<Record<string, TaskStatus>>({});
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [agents, setAgents] = useState<string[]>([]);
  const [status, setStatus] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const [newTask, setNewTask] = useState({
    description: "",
    agent: "",
  });

  const fetchTasks = useCallback(async () => {
    setLoading(true);
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

  const fetchTaskStatus = useCallback(async (taskId: string) => {
    try {
      const response = await fetch(`${API_BASE}/tasks/${taskId}/status`);
      if (response.ok) {
        const data = await response.json();
        setTaskStatuses(prev => ({ ...prev, [taskId]: data }));
      }
    } catch {
    }
  }, []);

  const fetchAllTaskStatuses = useCallback(async () => {
    for (const task of tasks) {
      if (task.session_id && !taskStatuses[task.id]?.session_info) {
        await fetchTaskStatus(task.id);
      }
    }
  }, [tasks, fetchTaskStatus, taskStatuses]);

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
        if (data.agents.includes("build") && !newTask.agent) {
          setNewTask(prev => ({ ...prev, agent: "build" }));
        }
      }
    } catch {
      setAgents([]);
    }
  }, [newTask.agent]);

  useEffect(() => {
    fetchTasks();
    fetchConfig();
  }, [fetchTasks, fetchConfig]);

  useEffect(() => {
    if (tasks.length > 0) {
      fetchAllTaskStatuses();
      const interval = setInterval(fetchAllTaskStatuses, 15000);
      return () => clearInterval(interval);
    }
  }, [tasks.length, fetchAllTaskStatuses]);

  const showStatus = (msg: string, type: "success" | "error") => {
    setStatus({ msg, type });
    setTimeout(() => setStatus(null), 5000);
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
        const data = await response.json();
        if (data.execution_error) {
          showStatus(`Task created but failed to execute: ${data.execution_error.error}`, "error");
        } else {
          showStatus(`Task created and running! Session: ${data.execution?.session_id}`, "success");
        }
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

  const refreshTask = async (taskId: string) => {
    setRefreshing(taskId);
    await fetchTaskStatus(taskId);
    await fetchTasks();
    setRefreshing(null);
  };

  const refreshAllTasks = async () => {
    setRefreshing("all");
    await fetchTasks();
    for (const task of tasks) {
      await fetchTaskStatus(task.id);
    }
    setRefreshing(null);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Working": return "text-blue-600";
      case "Creating Pull Request": return "text-yellow-600";
      case "Updating Jira": return "text-purple-600";
      case "Done": return "text-green-600";
      default: return "text-gray-600";
    }
  };

  return (
    <div className="flex flex-col items-center p-8 gap-6">
      <div className="pixel-font text-2xl font-bold">Task Management</div>

      {loading && !tasks.length && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {status && (
        <div className={cn(
          "pixel-font text-sm p-2 rounded max-w-2xl w-full",
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
            <div className="flex justify-between items-center">
              <CardTitle>Tasks ({tasks.length})</CardTitle>
              <Button
                size="sm"
                variant="secondary"
                onClick={refreshAllTasks}
                disabled={refreshing === "all"}
              >
                {refreshing === "all" ? "Refreshing..." : "Refresh All"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {tasks.map((task) => {
                const taskStatus = taskStatuses[task.id];
                const isRefreshing = refreshing === task.id;
                return (
                  <div key={task.id} className="border p-4 rounded">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="pixel-font">{task.description}</p>
                        <div className="pixel-font text-xs text-gray-500 mt-2 space-y-1">
                          {task.agent && <p>Agent: {task.agent}</p>}
                          <p>Created: {new Date(task.created_at).toLocaleString()}</p>
                          <p className={getStatusColor(taskStatus?.status || task.status)}>
                            Status: {taskStatus?.status || task.status}
                          </p>
                          {taskStatus?.session_url && (
                            <a
                              href={taskStatus.session_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline block"
                            >
                              Open Session: {taskStatus.session_id}
                            </a>
                          )}
                          {!taskStatus?.session_url && task.session_id && (
                            <p className="text-gray-400">Session: {task.session_id}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => refreshTask(task.id)}
                          disabled={isRefreshing || refreshing === "all"}
                        >
                          {isRefreshing ? "..." : "Refresh"}
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
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
