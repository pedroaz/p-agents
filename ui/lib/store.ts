import { create } from "zustand";

const API_BASE = "http://localhost:5556";

export interface Toast {
  id: string;
  msg: string;
  type: "success" | "error";
}

export interface Task {
  id: string;
  description: string;
  agent: string;
  source: string;
  jira_ticket: string;
  created_at: string;
  status: string;
  session_id: string | null;
}

export interface TaskStatus {
  task_id: string;
  status: string;
  session_id: string | null;
  session_url: string | null;
  session_info: unknown;
}

export interface Process {
  id: string;
  pid: number;
  command: string;
  log_file: string;
  started_at: string;
  running: boolean;
}

export interface GitStatus {
  working_dir: string;
  current_branch: string;
  uncommitted_files: number;
  has_changes: boolean;
}

export interface PullRequest {
  number: number;
  title: string;
  state: string;
  url: string;
  headRefName: string;
}

export interface ServerStatus {
  running: boolean;
  pid: number | null;
  port: number;
  has_auth: boolean;
  username: string;
}

export interface CliStatus {
  available: boolean;
  version: string | null;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (msg: string, type: "success" | "error") => void;
  removeToast: (id: string) => void;
}

interface TaskStore {
  tasks: Task[];
  taskStatuses: Record<string, TaskStatus>;
  loading: boolean;
  creating: boolean;
  refreshing: string | null;
  agents: string[];
  newTask: { description: string; agent: string };
  setNewTask: (task: { description: string; agent: string }) => void;
  fetchTasks: () => Promise<void>;
  fetchTaskStatus: (taskId: string) => Promise<void>;
  fetchAgents: (dir: string) => Promise<void>;
  createTask: () => Promise<boolean>;
  deleteTask: (taskId: string) => Promise<boolean>;
  refreshTask: (taskId: string) => Promise<void>;
  refreshAllTasks: () => Promise<void>;
}

interface ApplicationStore {
  starting: boolean;
  killing: boolean;
  status: string | null;
  statusType: "success" | "error" | null;
  processes: Process[];
  logs: string;
  selectedSession: string | null;
  fetchingLogs: boolean;
  fetchProcesses: () => Promise<void>;
  fetchLogs: (sessionId: string) => Promise<void>;
  startApplication: () => Promise<void>;
  killApplication: () => Promise<void>;
  setSelectedSession: (sessionId: string | null) => void;
}

interface GitStore {
  status: GitStatus | null;
  pulls: PullRequest[];
  branches: string[];
  loading: boolean;
  error: string | null;
  switchBranch: string;
  newBranchName: string;
  createPrTitle: string;
  createPrBody: string;
  actionLoading: string | null;
  success: string | null;
  prSuccess: string | null;
  fetchStatus: () => Promise<void>;
  fetchPulls: () => Promise<void>;
  fetchBranches: () => Promise<void>;
  refreshAll: () => Promise<void>;
  setSwitchBranch: (branch: string) => void;
  setNewBranchName: (name: string) => void;
  setCreatePrTitle: (title: string) => void;
  setCreatePrBody: (body: string) => void;
  handleSwitchBranch: () => Promise<void>;
  handleCreateBranch: () => Promise<void>;
  handleCreatePr: () => Promise<void>;
  handleUpdatePr: () => Promise<void>;
  handleReset: () => Promise<void>;
}

interface OpenCodeStore {
  cliStatus: CliStatus | null;
  serverStatus: ServerStatus | null;
  loading: boolean;
  checking: boolean;
  starting: boolean;
  stopping: boolean;
  error: string | null;
  checkStatus: () => Promise<void>;
  startServer: () => Promise<void>;
  stopServer: () => Promise<void>;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  addToast: (msg, type) => {
    const id = Date.now().toString();
    set((state) => ({ toasts: [...state.toasts, { id, msg, type }] }));
    setTimeout(() => get().removeToast(id), 5000);
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  taskStatuses: {},
  loading: false,
  creating: false,
  refreshing: null,
  agents: [],
  newTask: { description: "", agent: "" },
  setNewTask: (task) => set({ newTask: task }),

  fetchTasks: async () => {
    set({ loading: true });
    try {
      const response = await fetch(`${API_BASE}/tasks`);
      if (response.ok) {
        const data = await response.json();
        set({ tasks: data.tasks });
      }
    } catch {
    } finally {
      set({ loading: false });
    }
  },

  fetchTaskStatus: async (taskId: string) => {
    try {
      const response = await fetch(`${API_BASE}/tasks/${taskId}/status`);
      if (response.ok) {
        const data = await response.json();
        set((state) => ({ taskStatuses: { ...state.taskStatuses, [taskId]: data } }));
      }
    } catch {
    }
  },

  fetchAgents: async (dir: string) => {
    try {
      const response = await fetch(`${API_BASE}/agents?dir=${encodeURIComponent(dir)}`);
      if (response.ok) {
        const data = await response.json();
        set({ agents: data.agents });
        if (data.agents.includes("build") && !get().newTask.agent) {
          set((state) => ({ newTask: { ...state.newTask, agent: "build" } }));
        }
      }
    } catch {
      set({ agents: [] });
    }
  },

  createTask: async () => {
    const { newTask } = useTaskStore.getState();
    const addToast = useToastStore.getState().addToast;
    
    if (!newTask.description) {
      addToast("Description is required", "error");
      return false;
    }

    set({ creating: true });
    try {
      const response = await fetch(`${API_BASE}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTask),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.execution_error) {
          addToast(`Task created but failed to execute: ${data.execution_error.error}`, "error");
        } else {
          addToast(`Task created and running! Session: ${data.execution?.session_id}`, "success");
        }
        set({ newTask: { description: "", agent: "" } });
        await get().fetchTasks();
        return true;
      } else {
        addToast("Failed to create task", "error");
        return false;
      }
    } catch {
      addToast("Failed to create task", "error");
      return false;
    } finally {
      set({ creating: false });
    }
  },

  deleteTask: async (taskId: string) => {
    const { fetchTasks } = get();
    const addToast = useToastStore.getState().addToast;
    
    try {
      const response = await fetch(`${API_BASE}/tasks/${taskId}`, { method: "DELETE" });
      if (response.ok) {
        addToast("Task deleted!", "success");
        await fetchTasks();
        return true;
      } else {
        addToast("Failed to delete task", "error");
        return false;
      }
    } catch {
      addToast("Failed to delete task", "error");
      return false;
    }
  },

  refreshTask: async (taskId: string) => {
    set({ refreshing: taskId });
    await get().fetchTaskStatus(taskId);
    await get().fetchTasks();
    set({ refreshing: null });
  },

  refreshAllTasks: async () => {
    set({ refreshing: "all" });
    await get().fetchTasks();
    for (const task of get().tasks) {
      await get().fetchTaskStatus(task.id);
    }
    set({ refreshing: null });
  },
}));

export const useApplicationStore = create<ApplicationStore>((set, get) => ({
  starting: false,
  killing: false,
  status: null,
  statusType: null,
  processes: [],
  logs: "",
  selectedSession: null,
  fetchingLogs: false,

  fetchProcesses: async () => {
    try {
      const response = await fetch(`${API_BASE}/application/processes`);
      if (response.ok) {
        const data = await response.json();
        set({ processes: data.processes });
      }
    } catch {
    }
  },

  fetchLogs: async (sessionId: string) => {
    set({ fetchingLogs: true });
    try {
      const response = await fetch(`${API_BASE}/application/logs/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        set({ logs: data.logs || "" });
      }
    } catch {
    } finally {
      set({ fetchingLogs: false });
    }
  },

  setSelectedSession: (sessionId) => set({ selectedSession: sessionId }),

  startApplication: async () => {
    const { addToast } = useToastStore.getState();
    set({ starting: true, status: null, statusType: null });
    try {
      const response = await fetch(`${API_BASE}/application/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        const data = await response.json();
        set({ status: "Application started!", statusType: "success" });
        addToast("Application started!", "success");
        await get().fetchProcesses();
        if (data.session_id) {
          set({ selectedSession: data.session_id });
        }
      } else {
        const error = await response.json();
        set({ status: error.error || "Failed to start application", statusType: "error" });
        addToast(error.error || "Failed to start application", "error");
      }
    } catch {
      set({ status: "Failed to start application", statusType: "error" });
      addToast("Failed to start application", "error");
    } finally {
      set({ starting: false });
    }
  },

  killApplication: async () => {
    const { addToast } = useToastStore.getState();
    set({ killing: true, status: null, statusType: null });
    try {
      const response = await fetch(`${API_BASE}/application/kill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        set({ status: "Application killed!", statusType: "success" });
        addToast("Application killed!", "success");
        await get().fetchProcesses();
        set({ logs: "", selectedSession: null });
      } else {
        set({ status: "Failed to kill application", statusType: "error" });
        addToast("Failed to kill application", "error");
      }
    } catch {
      set({ status: "Failed to kill application", statusType: "error" });
      addToast("Failed to kill application", "error");
    } finally {
      set({ killing: false });
    }
  },
}));

export const useGitStore = create<GitStore>((set, get) => ({
  status: null,
  pulls: [],
  branches: [],
  loading: false,
  error: null,
  switchBranch: "",
  newBranchName: "",
  createPrTitle: "",
  createPrBody: "",
  actionLoading: null,
  success: null,
  prSuccess: null,

  setSwitchBranch: (branch) => set({ switchBranch: branch }),
  setNewBranchName: (name) => set({ newBranchName: name }),
  setCreatePrTitle: (title) => set({ createPrTitle: title }),
  setCreatePrBody: (body) => set({ createPrBody: body }),

  fetchStatus: async () => {
    try {
      const response = await fetch(`${API_BASE}/git/status`);
      if (response.ok) {
        const data = await response.json();
        set({ status: data });
      } else {
        const data = await response.json();
        set({ error: data.error || "Failed to fetch git status" });
      }
    } catch {
      set({ error: "Failed to connect to server" });
    }
  },

  fetchPulls: async () => {
    try {
      const response = await fetch(`${API_BASE}/git/pulls`);
      if (response.ok) {
        const data = await response.json();
        set({ pulls: data.pulls || [] });
      }
    } catch {
    }
  },

  fetchBranches: async () => {
    try {
      const response = await fetch(`${API_BASE}/git/branches`);
      if (response.ok) {
        const data = await response.json();
        set({ branches: data.branches || [] });
      }
    } catch {
    }
  },

  refreshAll: async () => {
    set({ loading: true, error: null });
    await get().fetchStatus();
    await get().fetchPulls();
    await get().fetchBranches();
    set({ loading: false });
  },

  handleSwitchBranch: async () => {
    const { switchBranch } = useGitStore.getState();
    const addToast = useToastStore.getState().addToast;
    
    if (!switchBranch) return;
    set({ actionLoading: "switch", error: null, success: null });
    try {
      const response = await fetch(`${API_BASE}/git/switch-branch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: switchBranch }),
      });
      if (response.ok) {
        set({ switchBranch: "" });
        await get().refreshAll();
        addToast("Branch switched successfully", "success");
      } else {
        const data = await response.json();
        set({ error: data.error || "Failed to switch branch" });
        addToast(data.error || "Failed to switch branch", "error");
      }
    } catch {
      set({ error: "Failed to switch branch" });
      addToast("Failed to switch branch", "error");
    } finally {
      set({ actionLoading: null });
    }
  },

  handleCreateBranch: async () => {
    const { newBranchName } = useGitStore.getState();
    const addToast = useToastStore.getState().addToast;
    
    if (!newBranchName) return;
    set({ actionLoading: "create-branch", error: null, success: null });
    try {
      const response = await fetch(`${API_BASE}/git/create-branch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBranchName }),
      });
      if (response.ok) {
        set({ newBranchName: "" });
        await get().refreshAll();
        addToast("Branch created successfully", "success");
      } else {
        const data = await response.json();
        set({ error: data.error || "Failed to create branch" });
        addToast(data.error || "Failed to create branch", "error");
      }
    } catch {
      set({ error: "Failed to create branch" });
      addToast("Failed to create branch", "error");
    } finally {
      set({ actionLoading: null });
    }
  },

  handleCreatePr: async () => {
    const { createPrTitle, createPrBody } = useGitStore.getState();
    const addToast = useToastStore.getState().addToast;
    
    if (!createPrTitle) return;
    set({ actionLoading: "create-pr", error: null, success: null, prSuccess: null });
    try {
      const response = await fetch(`${API_BASE}/git/create-pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: createPrTitle, body: createPrBody }),
      });
      if (response.ok) {
        const data = await response.json();
        set({ createPrTitle: "", createPrBody: "", prSuccess: data.url });
        await get().fetchPulls();
        addToast("PR created successfully", "success");
      } else {
        const data = await response.json();
        set({ error: data.error || "Failed to create PR" });
        addToast(data.error || "Failed to create PR", "error");
      }
    } catch {
      set({ error: "Failed to create PR" });
      addToast("Failed to create PR", "error");
    } finally {
      set({ actionLoading: null });
    }
  },

  handleUpdatePr: async () => {
    const addToast = useToastStore.getState().addToast;
    
    set({ actionLoading: "update-pr", error: null, success: null, prSuccess: null });
    try {
      const response = await fetch(`${API_BASE}/git/push`, { method: "POST" });
      if (response.ok) {
        set({ prSuccess: "Branch pushed successfully" });
        addToast("Branch pushed successfully", "success");
      } else {
        const data = await response.json();
        set({ error: data.error || "Failed to push" });
        addToast(data.error || "Failed to push", "error");
      }
    } catch {
      set({ error: "Failed to push" });
      addToast("Failed to push", "error");
    } finally {
      set({ actionLoading: null });
    }
  },

  handleReset: async () => {
    const addToast = useToastStore.getState().addToast;
    
    try {
      const response = await fetch(`${API_BASE}/git/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discard: true, base: "main" }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          set({
            status: {
              ...get().status!,
              current_branch: data.branch,
              uncommitted_files: 0,
              has_changes: false,
            },
          });
          addToast("Branch reset successfully", "success");
        } else {
          addToast(data.errors?.join(", ") || "Reset failed", "error");
        }
      }
    } catch {
      addToast("Failed to reset branch", "error");
    }
  },
}));

export const useOpenCodeStore = create<OpenCodeStore>((set, get) => ({
  cliStatus: null,
  serverStatus: null,
  loading: false,
  checking: false,
  starting: false,
  stopping: false,
  error: null,

  checkStatus: async () => {
    set({ checking: true, error: null });
    try {
      const [cliResponse, serverResponse] = await Promise.all([
        fetch(`${API_BASE}/configuration`),
        fetch(`${API_BASE}/opencode/status`),
      ]);

      if (cliResponse.ok) {
        const data = await cliResponse.json();
        set({
          cliStatus: {
            available: data.opencode?.available || false,
            version: data.opencode?.version || null,
          },
        });
      }

      if (serverResponse.ok) {
        const serverData = await serverResponse.json();
        set({ serverStatus: serverData });
      }
    } catch {
      set({
        error: "Failed to check status",
        cliStatus: { available: false, version: null },
        serverStatus: { running: false, pid: null, port: 5557, has_auth: false, username: "opencode" },
      });
    } finally {
      set({ loading: false, checking: false });
    }
  },

  startServer: async () => {
    const { addToast } = useToastStore.getState();
    set({ starting: true, error: null });
    try {
      const response = await fetch(`${API_BASE}/opencode/start`, { method: "POST" });
      if (response.ok) {
        await get().checkStatus();
        addToast("OpenCode server started", "success");
      } else {
        const data = await response.json();
        set({ error: data.error || "Failed to start server" });
        addToast(data.error || "Failed to start server", "error");
      }
    } catch {
      set({ error: "Failed to start server" });
      addToast("Failed to start server", "error");
    } finally {
      set({ starting: false });
    }
  },

  stopServer: async () => {
    const { addToast } = useToastStore.getState();
    set({ stopping: true, error: null });
    try {
      const response = await fetch(`${API_BASE}/opencode/stop`, { method: "POST" });
      if (response.ok) {
        await get().checkStatus();
        addToast("OpenCode server stopped", "success");
      } else {
        const data = await response.json();
        set({ error: data.error || "Failed to stop server" });
        addToast(data.error || "Failed to stop server", "error");
      }
    } catch {
      set({ error: "Failed to stop server" });
      addToast("Failed to stop server", "error");
    } finally {
      set({ stopping: false });
    }
  },
}));

const gitStore = useGitStore.getState();
useGitStore.setState({
  ...gitStore,
  fetchStatus: async () => {
    try {
      const response = await fetch(`${API_BASE}/git/status`);
      if (response.ok) {
        const data = await response.json();
        useGitStore.setState({ status: data });
        useToastStore.getState().addToast?.("Git status updated", "success");
      }
    } catch {
      useToastStore.getState().addToast?.("Failed to fetch git status", "error");
    }
  }
});