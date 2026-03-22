"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export interface SystemCheck {
  available?: boolean;
  running?: boolean;
  set?: boolean;
  exists?: boolean;
  version?: string | null;
  timeout?: boolean;
}

export interface SystemChecks {
  opencode: SystemCheck;
  docker: SystemCheck;
  jira_api_key: SystemCheck;
  jira_token: SystemCheck;
  env_file: SystemCheck;
}

export interface ApplicationConfig {
  start_commands: string[];
  kill_command: string;
  ui_url: string;
  working_folder: string;
}

export interface OpenCodeConfig {
  working_folder: string;
  username: string;
  password: string;
}

export interface Configuration {
  systemChecks: SystemChecks;
  opencode: OpenCodeConfig;
  application: ApplicationConfig;
}

interface ConfigurationContextType {
  configuration: Configuration | null;
  loading: boolean;
  error: string | null;
  refreshConfiguration: () => Promise<void>;
  updateOpenCodeConfig: (config: Partial<OpenCodeConfig>) => Promise<void>;
  updateApplicationConfig: (config: Partial<ApplicationConfig>) => Promise<void>;
}

const ConfigurationContext = createContext<ConfigurationContextType | null>(null);

const API_BASE = "http://localhost:5556";

export function ConfigurationProvider({ children }: { children: React.ReactNode }) {
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshConfiguration = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [configResponse, appResponse] = await Promise.all([
        fetch(`${API_BASE}/configuration`),
        fetch(`${API_BASE}/application`),
      ]);

      if (!configResponse.ok || !appResponse.ok) {
        throw new Error("Failed to fetch configuration");
      }

      const configData = await configResponse.json();
      const appData = await appResponse.json();

      setConfiguration({
        systemChecks: {
          opencode: configData.opencode,
          docker: configData.docker,
          jira_api_key: configData.jira_api_key,
          jira_token: configData.jira_token,
          env_file: configData.env_file,
        },
        opencode: {
          working_folder: configData.opencode_working_folder || "",
          username: configData.opencode_username || "opencode",
          password: configData.opencode_password || "",
        },
        application: {
          start_commands: appData.start_commands || [],
          kill_command: appData.kill_command || "",
          ui_url: appData.ui_url || "",
          working_folder: appData.working_folder || "",
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  const updateOpenCodeConfig = useCallback(async (config: Partial<OpenCodeConfig>) => {
    const response = await fetch(`${API_BASE}/configuration/opencode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!response.ok) {
      throw new Error("Failed to update OpenCode configuration");
    }
    await refreshConfiguration();
  }, [refreshConfiguration]);

  const updateApplicationConfig = useCallback(async (config: Partial<ApplicationConfig>) => {
    const currentConfig = configuration?.application || {
      start_commands: [],
      kill_command: "",
      ui_url: "",
      working_folder: "",
    };
    const response = await fetch(`${API_BASE}/application`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...currentConfig, ...config }),
    });
    if (!response.ok) {
      throw new Error("Failed to update application configuration");
    }
    await refreshConfiguration();
  }, [configuration, refreshConfiguration]);

  useEffect(() => {
    refreshConfiguration();
  }, [refreshConfiguration]);

  return (
    <ConfigurationContext.Provider
      value={{
        configuration,
        loading,
        error,
        refreshConfiguration,
        updateOpenCodeConfig,
        updateApplicationConfig,
      }}
    >
      {children}
    </ConfigurationContext.Provider>
  );
}

export function useConfiguration() {
  const context = useContext(ConfigurationContext);
  if (!context) {
    throw new Error("useConfiguration must be used within a ConfigurationProvider");
  }
  return context;
}
