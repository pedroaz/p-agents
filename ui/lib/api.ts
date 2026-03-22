const API_BASE = "http://localhost:5556";

export interface ConfigurationResponse {
  opencode: {
    available: boolean;
    version: string | null;
  };
  docker: {
    running: boolean;
    timeout?: boolean;
  };
  jira_api_key: {
    set: boolean;
  };
  env_file: {
    exists: boolean;
  };
  opencode_working_folder: string;
  opencode_username: string;
  opencode_password: string;
}

export async function getConfiguration(): Promise<ConfigurationResponse> {
  const response = await fetch(`${API_BASE}/configuration`);
  if (!response.ok) {
    throw new Error(`Failed to fetch configuration: ${response.statusText}`);
  }
  return response.json();
}

export async function updateOpenCodeWorkingFolder(workingFolder: string): Promise<void> {
  const response = await fetch(`${API_BASE}/configuration/opencode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ working_folder: workingFolder }),
  });
  if (!response.ok) {
    throw new Error(`Failed to update opencode configuration: ${response.statusText}`);
  }
}

export async function updateOpenCodeConfig(config: {
  working_folder?: string;
  username?: string;
  password?: string;
}): Promise<void> {
  const response = await fetch(`${API_BASE}/configuration/opencode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!response.ok) {
    throw new Error(`Failed to update opencode configuration: ${response.statusText}`);
  }
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

export interface GitPullsResponse {
  pulls: PullRequest[];
  count: number;
}

export interface GitBranchesResponse {
  branches: string[];
}

export async function getGitStatus(): Promise<GitStatus> {
  const response = await fetch(`${API_BASE}/git/status`);
  if (!response.ok) {
    throw new Error(`Failed to fetch git status: ${response.statusText}`);
  }
  return response.json();
}

export async function getGitPulls(): Promise<GitPullsResponse> {
  const response = await fetch(`${API_BASE}/git/pulls`);
  if (!response.ok) {
    throw new Error(`Failed to fetch git pulls: ${response.statusText}`);
  }
  return response.json();
}

export async function getGitBranches(): Promise<GitBranchesResponse> {
  const response = await fetch(`${API_BASE}/git/branches`);
  if (!response.ok) {
    throw new Error(`Failed to fetch git branches: ${response.statusText}`);
  }
  return response.json();
}

export async function switchGitBranch(branch: string): Promise<void> {
  const response = await fetch(`${API_BASE}/git/switch-branch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branch }),
  });
  if (!response.ok) {
    throw new Error(`Failed to switch branch: ${response.statusText}`);
  }
}

export async function createGitBranch(name: string, from?: string): Promise<void> {
  const response = await fetch(`${API_BASE}/git/create-branch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, from }),
  });
  if (!response.ok) {
    throw new Error(`Failed to create branch: ${response.statusText}`);
  }
}

export async function createGitPull(title: string, body?: string, base?: string): Promise<{ url: string }> {
  const response = await fetch(`${API_BASE}/git/create-pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, body, base }),
  });
  if (!response.ok) {
    throw new Error(`Failed to create pull request: ${response.statusText}`);
  }
  return response.json();
}