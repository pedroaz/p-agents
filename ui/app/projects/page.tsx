"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/pixelact-ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/pixelact-ui/card";
import { Spinner } from "@/components/ui/pixelact-ui/spinner";
import { Input } from "@/components/ui/pixelact-ui/input";
import { useProjectStore, Project } from "@/lib/store";
import { useGitStore } from "@/lib/store";
import "@/components/ui/pixelact-ui/styles/styles.css";

interface ProjectFormData {
  name: string;
  folder_path: string;
  jira_board_id: string;
  application: {
    start_commands: string[];
    kill_command: string;
    ui_url: string;
  };
}

export default function Projects() {
  const {
    projects,
    currentProject,
    loading,
    error,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    setCurrentProject,
  } = useProjectStore();

  const { fetchStatus } = useGitStore();

  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<ProjectFormData>({
    name: "",
    folder_path: "",
    jira_board_id: "",
    application: {
      start_commands: [],
      kill_command: "",
      ui_url: "",
    },
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const resetForm = () => {
    setFormData({
      name: "",
      folder_path: "",
      jira_board_id: "",
      application: {
        start_commands: [],
        kill_command: "",
        ui_url: "",
      },
    });
    setEditingProject(null);
    setShowForm(false);
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      folder_path: project.folder_path,
      jira_board_id: project.jira_board_id || "",
      application: project.application || {
        start_commands: [],
        kill_command: "",
        ui_url: "",
      },
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formData.name) return;

    setSaving(true);
    try {
      if (editingProject) {
        await updateProject(editingProject.id, formData);
      } else {
        await createProject(formData);
      }
      resetForm();
      await fetchProjects();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm("Are you sure you want to delete this project?")) return;
    await deleteProject(projectId);
  };

  const handleSetCurrent = async (projectId: string) => {
    await setCurrentProject(projectId);
    await fetchProjects();
    await fetchStatus();
  };

  const updateStartCommand = (index: number, value: string) => {
    const newCommands = [...formData.application.start_commands];
    newCommands[index] = value;
    setFormData({
      ...formData,
      application: { ...formData.application, start_commands: newCommands },
    });
  };

  const addStartCommand = () => {
    setFormData({
      ...formData,
      application: {
        ...formData.application,
        start_commands: [...formData.application.start_commands, ""],
      },
    });
  };

  const removeStartCommand = (index: number) => {
    const newCommands = formData.application.start_commands.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      application: { ...formData.application, start_commands: newCommands },
    });
  };

  if (loading && projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="pixel-font text-3xl font-bold">Projects</h1>
          {!showForm && (
            <Button onClick={() => setShowForm(true)} variant="default" size="lg">
              + New Project
            </Button>
          )}
        </div>

        {error && (
          <div className="pixel-font text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200 mb-4">
            {error}
          </div>
        )}

        {currentProject && (
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="pixel-font font-bold text-lg text-blue-800">{currentProject.name}</span>
                    <span className="pixel-font text-xs px-2 py-0.5 bg-blue-200 text-blue-800 rounded">Active</span>
                  </div>
                  <p className="pixel-font text-sm text-gray-600">
                    {currentProject.folder_path || "No folder set"}
                  </p>
                </div>
                {currentProject.jira_board_id && (
                  <div className="pixel-font text-sm text-gray-500">
                    Jira: {currentProject.jira_board_id}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {showForm && (
        <Card className="mb-8 border-2 border-blue-200">
          <CardHeader className="bg-gray-50 border-b">
            <CardTitle className="text-xl">
              {editingProject ? "Edit Project" : "Create New Project"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="pixel-font text-sm font-bold">Project Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My Awesome Project"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <label className="pixel-font text-sm font-bold">Jira Board ID</label>
                <Input
                  value={formData.jira_board_id}
                  onChange={(e) => setFormData({ ...formData, jira_board_id: e.target.value })}
                  placeholder="BOARD-123"
                  className="w-full"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="pixel-font text-sm font-bold">Folder Path</label>
                <Input
                  value={formData.folder_path}
                  onChange={(e) => setFormData({ ...formData, folder_path: e.target.value })}
                  placeholder="/Users/you/path/to/project"
                  className="w-full"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="pixel-font text-sm font-bold">UI URL</label>
                <Input
                  value={formData.application.ui_url}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      application: { ...formData.application, ui_url: e.target.value },
                    })
                  }
                  placeholder="http://localhost:3000"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <label className="pixel-font text-sm font-bold">Kill Command</label>
                <Input
                  value={formData.application.kill_command}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      application: { ...formData.application, kill_command: e.target.value },
                    })
                  }
                  placeholder="make stop"
                  className="w-full"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="pixel-font text-sm font-bold">Start Commands</label>
                <div className="space-y-2">
                  {formData.application.start_commands.map((cmd, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={cmd}
                        onChange={(e) => updateStartCommand(index, e.target.value)}
                        placeholder={`Command ${index + 1}`}
                        className="flex-1"
                      />
                      {formData.application.start_commands.length > 1 && (
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
                    + Add Command
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t">
              <Button
                onClick={handleSubmit}
                disabled={saving || !formData.name}
                variant="default"
                size="lg"
              >
                {saving ? "Saving..." : editingProject ? "Update Project" : "Create Project"}
              </Button>
              <Button onClick={resetForm} variant="secondary" size="lg">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="pixel-font text-xl font-bold mb-4">All Projects ({projects.length})</h2>
        {projects.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="pixel-font text-gray-500">No projects yet. Create one to get started!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Card
                key={project.id}
                className={
                  currentProject?.id === project.id
                    ? "border-blue-500"
                    : ""
                }
              >
                <CardContent className="p-4">
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="pixel-font font-bold">{project.name}</h3>
                      {currentProject?.id === project.id && (
                        <span className="pixel-font text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="pixel-font text-xs text-gray-500 truncate" title={project.folder_path || "No folder set"}>
                      {project.folder_path || "No folder set"}
                    </p>
                    {project.jira_board_id && (
                      <p className="pixel-font text-xs text-gray-400">
                        Jira: {project.jira_board_id}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-3 border-t">
                    {currentProject?.id !== project.id && (
                      <Button
                        onClick={() => handleSetCurrent(project.id)}
                        variant="default"
                        size="sm"
                      >
                        Set Active
                      </Button>
                    )}
                    <Button
                      onClick={() => handleEdit(project)}
                      variant="secondary"
                      size="sm"
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleDelete(project.id)}
                      variant="destructive"
                      size="sm"
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
