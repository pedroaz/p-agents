"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/pixelact-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/pixelact-ui/card";
import { Spinner } from "@/components/ui/pixelact-ui/spinner";
import { useTaskStore, Task } from "@/lib/store";
import "@/components/ui/pixelact-ui/styles/styles.css";

interface Config {
  opencode_working_folder: string;
  jira_token: { set: boolean };
}

const API_BASE = "http://localhost:5556";

export default function TaskManagement() {
  const {
    tasks,
    taskStatuses,
    loading,
    creating,
    refreshing,
    agents,
    newTask,
    setNewTask,
    fetchTasks,
    fetchTaskStatus,
    fetchAgents,
    createTask,
    deleteTask,
    refreshTask,
    refreshAllTasks,
  } = useTaskStore();

  const [config, setConfig] = useState<Config | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/configuration`);
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        if (data.current_project?.folder_path) {
          fetchAgents(data.current_project.folder_path);
        } else if (data.opencode_working_folder) {
          fetchAgents(data.opencode_working_folder);
        }
      }
    } catch {
    }
  }, [fetchAgents]);

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchConfig();
  }, [fetchTasks, fetchConfig]);

  useEffect(() => {
    if (tasks.length > 0) {
      const interval = setInterval(() => {
        for (const task of tasks) {
          if (task.session_id && !taskStatuses[task.id]?.session_info) {
            fetchTaskStatus(task.id);
          }
        }
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [tasks.length, tasks, taskStatuses, fetchTaskStatus]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Working": return "text-blue-600";
      case "Creating Pull Request": return "text-yellow-600";
      case "Updating Jira": return "text-purple-600";
      case "Done": return "text-green-600";
      default: return "text-gray-600";
    }
  };

  const openTaskModal = (task: Task) => {
    setSelectedTask(task);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTask(null);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="pixel-font text-3xl font-bold mb-6">Task Management</h1>

        {loading && !tasks.length && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}

        {config?.current_project?.folder_path || config?.opencode_working_folder ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Create New Task</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="pixel-font text-sm font-bold block mb-1">Task Description *</label>
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
          <Card className="mb-6">
            <CardContent className="p-6">
              <p className="pixel-font text-sm text-red-600">
                Please set a project with a folder path first.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {tasks.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="pixel-font text-xl font-bold">Tasks ({tasks.length})</h2>
            <Button
              size="sm"
              variant="secondary"
              onClick={refreshAllTasks}
              disabled={refreshing === "all"}
            >
              {refreshing === "all" ? "Refreshing..." : "Refresh All"}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {tasks.map((task) => {
              const taskStatus = taskStatuses[task.id];
              const isRefreshing = refreshing === task.id;
              return (
                <Card key={task.id} className="relative cursor-pointer hover:border-blue-400" onClick={() => openTaskModal(task)}>
                  <CardContent className="p-4">
                    <div className="flex flex-col h-full">
                      <div className="flex-1">
                        <div className="mb-2">
                          <h3 className="pixel-font font-bold text-lg leading-tight">{task.title || task.description}</h3>
                          {task.project_name && (
                            <span className="pixel-font text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded mt-1 inline-block">
                              {task.project_name}
                            </span>
                          )}
                        </div>
                        <p className="pixel-font text-sm text-gray-600 mb-3 line-clamp-2">{task.description}</p>
                        
                        <div className="pixel-font text-xs text-gray-500 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={getStatusColor(taskStatus?.status || task.status)}>
                              {taskStatus?.status || task.status}
                            </span>
                            {task.agent && (
                              <span className="text-gray-400">| Agent: {task.agent}</span>
                            )}
                          </div>
                          <p>{new Date(task.created_at).toLocaleString()}</p>
                          {taskStatus?.session_url && (
                            <a
                              href={taskStatus.session_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline block"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Open in OpenCode
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4 pt-3 border-t" onClick={(e) => e.stopPropagation()}>
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
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {showModal && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between items-start">
              <div>
                <h2 className="pixel-font text-xl font-bold mb-1">{selectedTask.title || "Task Details"}</h2>
                {selectedTask.project_name && (
                  <span className="pixel-font text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                    {selectedTask.project_name}
                  </span>
                )}
              </div>
              <Button size="sm" variant="secondary" onClick={closeModal}>X</Button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="mb-4">
                <h3 className="pixel-font text-sm font-bold mb-1">Full Description</h3>
                <div className="bg-gray-50 p-3 rounded border whitespace-pre-wrap pixel-font text-sm">
                  {selectedTask.description}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="pixel-font font-bold">Status:</span>
                  <span className={`pixel-font ml-2 ${getStatusColor(taskStatuses[selectedTask.id]?.status || selectedTask.status)}`}>
                    {taskStatuses[selectedTask.id]?.status || selectedTask.status}
                  </span>
                </div>
                {selectedTask.agent && (
                  <div>
                    <span className="pixel-font font-bold">Agent:</span>
                    <span className="pixel-font ml-2">{selectedTask.agent}</span>
                  </div>
                )}
                <div>
                  <span className="pixel-font font-bold">Created:</span>
                  <span className="pixel-font ml-2">{new Date(selectedTask.created_at).toLocaleString()}</span>
                </div>
                {selectedTask.session_id && (
                  <div>
                    <span className="pixel-font font-bold">Session:</span>
                    <span className="pixel-font ml-2 text-xs">{selectedTask.session_id}</span>
                  </div>
                )}
              </div>

              {taskStatuses[selectedTask.id]?.session_url && (
                <div className="mt-4">
                  <a
                    href={taskStatuses[selectedTask.id].session_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pixel-font text-blue-600 hover:underline text-sm"
                  >
                    Open in OpenCode →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
