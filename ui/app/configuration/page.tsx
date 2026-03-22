"use client";

import { useState } from "react";
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
import { useConfiguration } from "@/lib/configuration-context";

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
  const {
    configuration,
    loading,
    error,
    refreshConfiguration,
    updateOpenCodeConfig,
    updateApplicationConfig,
  } = useConfiguration();

  const [workingFolder, setWorkingFolder] = useState("");
  const [username, setUsername] = useState("opencode");
  const [password, setPassword] = useState("");
  const [saveOpenCodeLoading, setSaveOpenCodeLoading] = useState(false);
  const [saveOpenCodeSuccess, setSaveOpenCodeSuccess] = useState(false);

  const [startCommands, setStartCommands] = useState<string[]>([]);
  const [killCommand, setKillCommand] = useState("");
  const [uiUrl, setUiUrl] = useState("");
  const [appWorkingFolder, setAppWorkingFolder] = useState("");
  const [saveAppLoading, setSaveAppLoading] = useState(false);
  const [saveAppSuccess, setSaveAppSuccess] = useState(false);

  const [configLoaded, setConfigLoaded] = useState(false);

  if (configuration && !configLoaded) {
    setWorkingFolder(configuration.opencode.working_folder);
    setUsername(configuration.opencode.username);
    setPassword(configuration.opencode.password);
    setStartCommands(configuration.application.start_commands);
    setKillCommand(configuration.application.kill_command);
    setUiUrl(configuration.application.ui_url);
    setAppWorkingFolder(configuration.application.working_folder);
    setConfigLoaded(true);
  }

  const saveOpenCodeSettings = async () => {
    setSaveOpenCodeLoading(true);
    setSaveOpenCodeSuccess(false);
    try {
      await updateOpenCodeConfig({
        working_folder: workingFolder,
        username: username,
        password: password,
      });
      setSaveOpenCodeSuccess(true);
      setTimeout(() => setSaveOpenCodeSuccess(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaveOpenCodeLoading(false);
    }
  };

  const updateStartCommand = (index: number, value: string) => {
    const newCommands = [...startCommands];
    newCommands[index] = value;
    setStartCommands(newCommands);
  };

  const addStartCommand = () => {
    setStartCommands([...startCommands, ""]);
  };

  const removeStartCommand = (index: number) => {
    const newCommands = startCommands.filter((_, i) => i !== index);
    setStartCommands(newCommands);
  };

  const saveApplicationSettings = async () => {
    setSaveAppLoading(true);
    setSaveAppSuccess(false);
    try {
      await updateApplicationConfig({
        start_commands: startCommands,
        kill_command: killCommand,
        ui_url: uiUrl,
        working_folder: appWorkingFolder,
      });
      setSaveAppSuccess(true);
      setTimeout(() => setSaveAppSuccess(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaveAppLoading(false);
    }
  };

  if (loading && !configuration) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 gap-6">
      <div className="pixel-font text-2xl font-bold">Configuration</div>

      {error && (
        <div className="pixel-font text-sm text-red-600">{error}</div>
      )}

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>System Checks</CardTitle>
          <CardDescription>
            Verify that all required components are installed and configured
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {configuration && (
            <div>
              <ConfigItem
                label="OpenCode"
                description="Command-line tool for AI-assisted coding"
                checked={configuration.systemChecks.opencode.available || false}
                warning={!configuration.systemChecks.opencode.available}
                details={
                  configuration.systemChecks.opencode.available
                    ? `Version: ${configuration.systemChecks.opencode.version}`
                    : "Not found. Install with: npm install -g opencode"
                }
              />

              <div className="p-4 border-b border-gray-200">
                <div className="pixel-font font-bold mb-2">OpenCode Settings</div>
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
                  <Button onClick={saveOpenCodeSettings} disabled={saveOpenCodeLoading} variant="default">
                    {saveOpenCodeLoading ? "Saving..." : "Save OpenCode Settings"}
                  </Button>
                  {saveOpenCodeSuccess && (
                    <p className="pixel-font text-xs text-green-600 mt-1">Saved successfully!</p>
                  )}
                </div>
              </div>

              <ConfigItem
                label="Docker"
                description="Container platform for running services"
                checked={configuration.systemChecks.docker.running || false}
                warning={!configuration.systemChecks.docker.running}
                details={
                  configuration.systemChecks.docker.running
                    ? "Docker daemon is running"
                    : "Docker is not running. Start Docker to use containerized services"
                }
              />

              <ConfigItem
                label="JIRA_API_KEY"
                description="API key for JIRA integration"
                checked={configuration.systemChecks.jira_api_key.set || false}
                warning={!configuration.systemChecks.jira_api_key.set}
                details={
                  configuration.systemChecks.jira_api_key.set
                    ? "API key is set in environment"
                    : "Set JIRA_API_KEY in your .env file"
                }
              />

              <ConfigItem
                label=".env File"
                description="Environment configuration file"
                checked={configuration.systemChecks.env_file.exists || false}
                warning={!configuration.systemChecks.env_file.exists}
                details={
                  configuration.systemChecks.env_file.exists
                    ? ".env file exists in server directory"
                    : "No .env file found in server directory"
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Application Settings</CardTitle>
          <CardDescription>
            Configure commands to start your application and related settings
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div>
              <label className="pixel-font font-bold block mb-2">
                Start Commands
              </label>
              <div className="space-y-2">
                {startCommands.length === 0 ? (
                  <Button onClick={addStartCommand} variant="secondary" size="sm">
                    Add Command
                  </Button>
                ) : (
                  <>
                    {startCommands.map((cmd, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={cmd}
                          onChange={(e) => updateStartCommand(index, e.target.value)}
                          placeholder={`Command ${index + 1}`}
                          className="flex-1"
                        />
                        {startCommands.length > 1 && (
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
                      Add Command
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="pixel-font font-bold block mb-2">
                Kill Command
              </label>
              <Input
                value={killCommand}
                onChange={(e) => setKillCommand(e.target.value)}
                placeholder="pkill -f 'process name' or killall ProcessName"
              />
            </div>

            <div>
              <label className="pixel-font font-bold block mb-2">
                Working Directory
              </label>
              <Input
                value={appWorkingFolder}
                onChange={(e) => setAppWorkingFolder(e.target.value)}
                placeholder="/path/to/application/folder"
              />
            </div>

            <div>
              <label className="pixel-font font-bold block mb-2">
                UI URL
              </label>
              <Input
                value={uiUrl}
                onChange={(e) => setUiUrl(e.target.value)}
                placeholder="http://localhost:3000"
              />
            </div>

            <Button onClick={saveApplicationSettings} disabled={saveAppLoading} variant="default">
              {saveAppLoading ? "Saving..." : "Save Application Settings"}
            </Button>
            {saveAppSuccess && (
              <p className="pixel-font text-xs text-green-600 mt-1">Saved successfully!</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Button onClick={refreshConfiguration} disabled={loading} variant="default">
        {loading ? "Checking..." : "Refresh Configuration"}
      </Button>
    </div>
  );
}
