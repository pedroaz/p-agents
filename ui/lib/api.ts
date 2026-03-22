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
}

export async function getConfiguration(): Promise<ConfigurationResponse> {
  const response = await fetch(`${API_BASE}/configuration`);
  if (!response.ok) {
    throw new Error(`Failed to fetch configuration: ${response.statusText}`);
  }
  return response.json();
}