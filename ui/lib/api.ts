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