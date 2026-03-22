"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/pixelact-ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/pixelact-ui/card";
import { Spinner } from "@/components/ui/pixelact-ui/spinner";
import { Checkbox } from "@/components/ui/pixelact-ui/checkbox";
import { Input } from "@/components/ui/pixelact-ui/input";
import { getConfiguration, updateOpenCodeConfig, ConfigurationResponse } from "@/lib/api";

interface ConfigItemProps {
  label: string;
  description: string;
  checked: boolean;
  warning?: boolean;
  details?: string;
}

function ConfigItem({
  label,
  description,
  checked,
  warning,
  details,
}: ConfigItemProps) {
  return (
    <div className="flex items-start gap-3 p-4 border-b border-gray-200 last:border-b-0">
      <Checkbox checked={checked} className="mt-1" />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="pixel-font font-bold">{label}</span>
          {warning && !checked && (
            <span className="pixel-font text-xs px-2 py-0.5 bg-yellow-200 text-yellow-800">
              Warning
            </span>
          )}
        </div>
        <CardDescription className="pixel-font text-sm mt-1">
          {description}
        </CardDescription>
        {details && (
          <p className="pixel-font text-xs text-gray-500 mt-1">{details}</p>
        )}
      </div>
    </div>
  );
}

export default function Configuration() {
  const [config, setConfig] = useState<ConfigurationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workingFolder, setWorkingFolder] = useState("");
  const [username, setUsername] = useState("opencode");
  const [password, setPassword] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getConfiguration();
      setConfig(data);
      setWorkingFolder(data.opencode_working_folder || "");
      setUsername(data.opencode_username || "opencode");
      setPassword(data.opencode_password || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  const saveOpenCodeConfig = async () => {
    setSaveLoading(true);
    setSaveSuccess(false);
    try {
      await updateOpenCodeConfig({
        working_folder: workingFolder,
        username: username,
        password: password,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save configuration");
    } finally {
      setSaveLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return (
    <div className="flex flex-col items-center justify-center p-8 gap-6">
      <div className="pixel-font text-2xl font-bold">Configuration</div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>System Checks</CardTitle>
          <CardDescription>
            Verify that all required components are installed and configured
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !config && (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          )}

          {error && (
            <div className="p-4 text-red-600 pixel-font text-sm text-center">
              {error}
            </div>
          )}

          {config && (
            <div>
              <ConfigItem
                label="OpenCode"
                description="Command-line tool for AI-assisted coding"
                checked={config.opencode.available}
                warning={!config.opencode.available}
                details={
                  config.opencode.available
                    ? `Version: ${config.opencode.version}`
                    : "Not found. Install with: npm install -g opencode"
                }
              />

              <div className="p-4 border-b border-gray-200">
                <div className="pixel-font font-bold mb-2">OpenCode Configuration</div>
                <CardDescription className="pixel-font text-sm mb-2">
                  Working directory, username and password for OpenCode web server
                </CardDescription>
                <div className="space-y-3">
                  <div>
                    <label className="pixel-font text-xs block mb-1">Working Folder</label>
                    <Input
                      value={workingFolder}
                      onChange={(e) => setWorkingFolder(e.target.value)}
                      placeholder="/path/to/working/folder"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="pixel-font text-xs block mb-1">Username</label>
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="opencode"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="pixel-font text-xs block mb-1">Password (leave empty for no auth)</label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="password"
                      className="w-full"
                    />
                  </div>
                  <Button onClick={saveOpenCodeConfig} disabled={saveLoading} variant="default">
                    {saveLoading ? "Saving..." : "Save"}
                  </Button>
                  {saveSuccess && (
                    <p className="pixel-font text-xs text-green-600 mt-1">Saved successfully!</p>
                  )}
                </div>
              </div>

              <ConfigItem
                label="Docker"
                description="Container platform for running services"
                checked={config.docker.running}
                warning={!config.docker.running}
                details={
                  config.docker.running
                    ? "Docker daemon is running"
                    : "Docker is not running. Start Docker to use containerized services"
                }
              />

              <ConfigItem
                label="JIRA_API_KEY"
                description="API key for JIRA integration"
                checked={config.jira_api_key.set}
                warning={!config.jira_api_key.set}
                details={
                  config.jira_api_key.set
                    ? "API key is set in environment"
                    : "Set JIRA_API_KEY in your .env file"
                }
              />

              <ConfigItem
                label=".env File"
                description="Environment configuration file"
                checked={config.env_file.exists}
                warning={!config.env_file.exists}
                details={
                  config.env_file.exists
                    ? ".env file exists in server directory"
                    : "No .env file found in server directory"
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={fetchConfig} disabled={loading} variant="default">
        {loading ? "Checking..." : "Check Configuration"}
      </Button>
    </div>
  );
}