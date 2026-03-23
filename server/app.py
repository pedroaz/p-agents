import os
import re
import json
import base64
import socket
import subprocess
import threading
import requests
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
LOGS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")

if not os.path.exists(LOGS_DIR):
    os.makedirs(LOGS_DIR)

running_processes = {}

OPENCODE_PORT = 5557
OPENCODE_PROCESS = {"pid": None, "proc": None}
OPENCODE_SERVER_URL = f"http://127.0.0.1:{OPENCODE_PORT}"


def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}


def save_config(config):
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)


def check_opencode():
    try:
        result = subprocess.run(
            ["opencode", "--version"], capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            version = result.stdout.strip() or result.stderr.strip()
            return {"available": True, "version": version}
        return {"available": False, "version": None}
    except FileNotFoundError:
        return {"available": False, "version": None}
    except subprocess.TimeoutExpired:
        return {"available": False, "version": "timeout"}
    except Exception:
        return {"available": False, "version": None}


def check_docker():
    try:
        result = subprocess.run(
            ["docker", "version"], capture_output=True, text=True, timeout=10
        )
        return {"running": result.returncode == 0}
    except FileNotFoundError:
        return {"running": False}
    except subprocess.TimeoutExpired:
        return {"running": False, "timeout": True}
    except Exception:
        return {"running": False}


def check_jira_token():
    token = os.environ.get("JIRA_TOKEN")
    return {"set": bool(token)}


def check_jira_api_key():
    key = os.environ.get("JIRA_API_KEY")
    return {"set": bool(key)}


def check_env_file():
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    return {"exists": os.path.isfile(env_path)}


@app.route("/")
def hello():
    return {"message": "Hello, World!"}


@app.route("/configuration")
def get_configuration():
    saved_config = load_config()
    config = {
        "opencode": check_opencode(),
        "docker": check_docker(),
        "jira_api_key": check_jira_api_key(),
        "jira_token": check_jira_token(),
        "env_file": check_env_file(),
        "opencode_working_folder": saved_config.get("opencode_working_folder", ""),
        "opencode_username": saved_config.get("opencode_username", "opencode"),
        "opencode_password": saved_config.get("opencode_password", ""),
    }
    return jsonify(config)


@app.route("/configuration/opencode", methods=["POST"])
def update_opencode_config():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    saved_config = load_config()
    if "working_folder" in data:
        saved_config["opencode_working_folder"] = data["working_folder"]
    if "username" in data:
        saved_config["opencode_username"] = data["username"]
    if "password" in data:
        saved_config["opencode_password"] = data["password"]
    save_config(saved_config)

    return jsonify({"success": True})


@app.route("/application")
def get_application_config():
    saved_config = load_config()
    app_config = saved_config.get("application", {})
    return jsonify(
        {
            "start_commands": app_config.get("start_commands", []),
            "kill_command": app_config.get("kill_command", ""),
            "ui_url": app_config.get("ui_url", ""),
            "working_folder": app_config.get("working_folder", ""),
        }
    )


@app.route("/application", methods=["POST"])
def save_application_config():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    saved_config = load_config()
    saved_config["application"] = {
        "start_commands": data.get("start_commands", []),
        "kill_command": data.get("kill_command", ""),
        "ui_url": data.get("ui_url", ""),
        "working_folder": data.get("working_folder", ""),
    }
    save_config(saved_config)

    return jsonify({"success": True})


@app.route("/application/start", methods=["POST"])
def start_application():
    global running_processes

    saved_config = load_config()
    app_config = saved_config.get("application", {})
    start_commands = app_config.get("start_commands", [])
    working_folder = app_config.get("working_folder", "")

    if not start_commands or all(c == "" for c in start_commands):
        return jsonify({"error": "No start commands configured"}), 400

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    session_id = f"app_{timestamp}"
    log_file = os.path.join(LOGS_DIR, f"{session_id}.log")

    started_processes = []

    try:
        for i, cmd in enumerate(start_commands):
            if cmd.strip():
                proc = subprocess.Popen(
                    cmd,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    cwd=working_folder if working_folder else None,
                )
                proc_id = f"{session_id}_{i}"
                running_processes[proc_id] = {
                    "pid": proc.pid,
                    "command": cmd,
                    "log_file": log_file,
                    "started_at": datetime.now().isoformat(),
                    "working_folder": working_folder,
                }
                started_processes.append(proc_id)

                thread = threading.Thread(
                    target=_stream_output, args=(proc, log_file, cmd)
                )
                thread.daemon = True
                thread.start()

        return jsonify(
            {
                "success": True,
                "session_id": session_id,
                "processes": started_processes,
                "log_file": log_file,
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _stream_output(proc, log_file, cmd):
    with open(log_file, "a") as f:
        f.write(f"[{datetime.now().isoformat()}] Starting command: {cmd}\n")
        f.flush()

        while True:
            line = proc.stdout.readline()
            if not line and proc.poll() is not None:
                break
            if line:
                f.write(f"[{datetime.now().isoformat()}] {line}")
                f.flush()

        stderr_line = proc.stderr.readline()
        while stderr_line:
            f.write(f"[{datetime.now().isoformat()}] [stderr] {stderr_line}")
            f.flush()
            stderr_line = proc.stderr.readline()

        f.write(
            f"[{datetime.now().isoformat()}] Process terminated with exit code: {proc.returncode}\n"
        )
        f.flush()


@app.route("/application/processes")
def get_processes():
    global running_processes

    active = []
    for proc_id, info in running_processes.items():
        try:
            os.kill(info["pid"], 0)
            active.append(
                {
                    "id": proc_id,
                    "pid": info["pid"],
                    "command": info["command"],
                    "log_file": info["log_file"],
                    "started_at": info["started_at"],
                    "running": True,
                }
            )
        except OSError:
            info["running"] = False
            active.append(
                {
                    "id": proc_id,
                    "pid": info["pid"],
                    "command": info["command"],
                    "log_file": info["log_file"],
                    "started_at": info["started_at"],
                    "running": False,
                }
            )

    return jsonify({"processes": active})


@app.route("/application/logs/<session_id>")
def get_logs(session_id):
    log_file = os.path.join(LOGS_DIR, f"{session_id}.log")

    if not os.path.exists(log_file):
        return jsonify({"error": "Log file not found"}), 404

    try:
        with open(log_file, "r") as f:
            content = f.read()
        return jsonify({"logs": content})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/application/kill", methods=["POST"])
def kill_application():
    global running_processes

    saved_config = load_config()
    app_config = saved_config.get("application", {})
    kill_command = app_config.get("kill_command", "")
    working_folder = app_config.get("working_folder", "")

    killed = []
    errors = []

    if kill_command:
        try:
            subprocess.run(
                kill_command,
                shell=True,
                capture_output=True,
                timeout=30,
                cwd=working_folder if working_folder else None,
            )
        except Exception as e:
            errors.append({"type": "kill_command", "error": str(e)})

    for proc_id, info in running_processes.items():
        try:
            os.kill(info["pid"], 9)
            killed.append(proc_id)
        except OSError as e:
            errors.append({"proc_id": proc_id, "error": str(e)})

    for proc_id in killed:
        del running_processes[proc_id]

    return jsonify({"success": True, "killed": killed, "errors": errors})


@app.route("/application/kill/<proc_id>", methods=["POST"])
def kill_single_process(proc_id):
    global running_processes

    if proc_id not in running_processes:
        return jsonify({"error": "Process not found"}), 404

    info = running_processes[proc_id]
    try:
        os.kill(info["pid"], 9)
        del running_processes[proc_id]
        return jsonify({"success": True})
    except OSError as e:
        return jsonify({"error": str(e)}), 500


def is_port_open(host, port, timeout=1):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False


@app.route("/opencode/status")
def opencode_status():
    global OPENCODE_PROCESS

    running = False
    pid = None
    has_auth = False

    if OPENCODE_PROCESS["pid"]:
        try:
            os.kill(OPENCODE_PROCESS["pid"], 0)
            running = True
            pid = OPENCODE_PROCESS["pid"]
        except OSError:
            OPENCODE_PROCESS["pid"] = None
            OPENCODE_PROCESS["proc"] = None

    if not running:
        running = is_port_open("127.0.0.1", OPENCODE_PORT)

    saved_config = load_config()
    if saved_config.get("opencode_password"):
        has_auth = True

    return jsonify(
        {
            "running": running,
            "pid": pid,
            "port": OPENCODE_PORT,
            "has_auth": has_auth,
            "username": saved_config.get("opencode_username", "opencode"),
        }
    )


@app.route("/opencode/start", methods=["POST"])
def opencode_start():
    global OPENCODE_PROCESS

    if OPENCODE_PROCESS["pid"]:
        try:
            os.kill(OPENCODE_PROCESS["pid"], 0)
            return jsonify(
                {
                    "error": "OpenCode server is already running",
                    "pid": OPENCODE_PROCESS["pid"],
                }
            ), 400
        except OSError:
            OPENCODE_PROCESS["pid"] = None
            OPENCODE_PROCESS["proc"] = None

    saved_config = load_config()
    working_folder = saved_config.get("opencode_working_folder", "")
    username = saved_config.get("opencode_username", "opencode")
    password = saved_config.get("opencode_password", "")

    env = os.environ.copy()
    if password:
        env["OPENCODE_SERVER_PASSWORD"] = password
        env["OPENCODE_SERVER_USERNAME"] = username

    cmd = f"opencode web --port {OPENCODE_PORT}"
    proc = subprocess.Popen(
        cmd,
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=working_folder if working_folder else None,
        env=env,
    )

    OPENCODE_PROCESS["pid"] = proc.pid
    OPENCODE_PROCESS["proc"] = proc

    return jsonify(
        {
            "success": True,
            "pid": proc.pid,
            "port": OPENCODE_PORT,
            "auth": bool(password),
        }
    )


@app.route("/opencode/stop", methods=["POST"])
def opencode_stop():
    global OPENCODE_PROCESS

    if not OPENCODE_PROCESS["pid"]:
        return jsonify({"error": "OpenCode server is not running"}), 400

    try:
        os.kill(OPENCODE_PROCESS["pid"], 9)
        OPENCODE_PROCESS["pid"] = None
        OPENCODE_PROCESS["proc"] = None
        return jsonify({"success": True})
    except OSError as e:
        return jsonify({"error": str(e)}), 500


@app.route("/opencode/restart", methods=["POST"])
def opencode_restart():
    global OPENCODE_PROCESS

    if OPENCODE_PROCESS["pid"]:
        try:
            os.kill(OPENCODE_PROCESS["pid"], 9)
        except OSError:
            pass

    OPENCODE_PROCESS["pid"] = None
    OPENCODE_PROCESS["proc"] = None

    saved_config = load_config()
    working_folder = saved_config.get("opencode_working_folder", "")
    username = saved_config.get("opencode_username", "opencode")
    password = saved_config.get("opencode_password", "")

    env = os.environ.copy()
    if password:
        env["OPENCODE_SERVER_PASSWORD"] = password
        env["OPENCODE_SERVER_USERNAME"] = username

    cmd = f"opencode web --port {OPENCODE_PORT}"
    proc = subprocess.Popen(
        cmd,
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=working_folder if working_folder else None,
        env=env,
    )

    OPENCODE_PROCESS["pid"] = proc.pid
    OPENCODE_PROCESS["proc"] = proc

    return jsonify(
        {
            "success": True,
            "pid": proc.pid,
            "port": OPENCODE_PORT,
            "auth": bool(password),
        }
    )


def get_opencode_auth():
    saved_config = load_config()
    username = saved_config.get("opencode_username", "opencode")
    password = saved_config.get("opencode_password", "")
    if password:
        return (username, password)
    return None


def format_model(model_str):
    if not model_str:
        return None
    parts = model_str.split("/")
    if len(parts) == 2:
        return {"providerID": parts[0], "modelID": parts[1]}
    return {"providerID": "minimax", "modelID": model_str}


def build_session_url(session_id, working_dir=None):
    if not session_id:
        return None
    if working_dir:
        encoded_path = (
            base64.b64encode(working_dir.encode())
            .decode()
            .replace("+", "-")
            .replace("/", "_")
            .rstrip("=")
        )
        return f"http://127.0.0.1:{OPENCODE_PORT}/{encoded_path}/session/{session_id}"
    return f"http://127.0.0.1:{OPENCODE_PORT}/session/{session_id}"


@app.route("/opencode/health")
def opencode_health():
    try:
        auth = get_opencode_auth()
        response = requests.get(
            f"{OPENCODE_SERVER_URL}/global/health",
            auth=auth if auth else None,
            timeout=5,
        )
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e), "connected": False}), 503


@app.route("/opencode/agents")
def opencode_agents():
    try:
        auth = get_opencode_auth()
        response = requests.get(
            f"{OPENCODE_SERVER_URL}/agent", auth=auth if auth else None, timeout=10
        )
        if response.status_code == 200:
            return jsonify(response.json())
        return jsonify(
            {"error": "Failed to get agents", "status": response.status_code}
        ), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@app.route("/opencode/sessions")
def opencode_sessions():
    try:
        auth = get_opencode_auth()
        response = requests.get(
            f"{OPENCODE_SERVER_URL}/session", auth=auth if auth else None, timeout=10
        )
        if response.status_code == 200:
            return jsonify(response.json())
        return jsonify(
            {"error": "Failed to get sessions", "status": response.status_code}
        ), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@app.route("/opencode/send-message", methods=["POST"])
def opencode_send_message():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    prompt = data.get("prompt")
    if not prompt:
        return jsonify({"error": "prompt is required"}), 400

    agent = data.get("agent", "")
    model = data.get("model", "")
    session_id = data.get("session_id")

    try:
        auth = get_opencode_auth()
        headers = {"Content-Type": "application/json"}

        if not session_id:
            create_response = requests.post(
                f"{OPENCODE_SERVER_URL}/session",
                auth=auth if auth else None,
                headers=headers,
                json={},
                timeout=10,
            )
            if create_response.status_code != 200:
                return jsonify(
                    {
                        "error": "Failed to create session",
                        "details": create_response.text,
                    }
                ), create_response.status_code
            session_data = create_response.json()
            session_id = session_data.get("id")

        message_body = {"parts": [{"type": "text", "text": prompt}]}
        if agent:
            message_body["agent"] = agent
        if model:
            message_body["model"] = format_model(model)

        send_response = requests.post(
            f"{OPENCODE_SERVER_URL}/session/{session_id}/message",
            auth=auth if auth else None,
            headers=headers,
            json=message_body,
            timeout=120,
        )

        if send_response.status_code == 200:
            return jsonify({"session_id": session_id, "response": send_response.json()})
        return jsonify(
            {"error": "Failed to send message", "details": send_response.text}
        ), send_response.status_code

    except requests.exceptions.Timeout:
        return jsonify({"error": "Request timed out", "session_id": session_id}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/opencode/sessions/<session_id>/abort", methods=["POST"])
def opencode_abort_session(session_id):
    try:
        auth = get_opencode_auth()
        response = requests.post(
            f"{OPENCODE_SERVER_URL}/session/{session_id}/abort",
            auth=auth if auth else None,
            timeout=10,
        )
        return jsonify({"success": response.status_code == 200})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


TASKS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tasks.json")

running_tasks = {}


def load_tasks():
    if os.path.exists(TASKS_FILE):
        try:
            with open(TASKS_FILE, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return []
    return []


def save_tasks(tasks):
    with open(TASKS_FILE, "w") as f:
        json.dump(tasks, f, indent=2)


def check_jira_token():
    key = os.environ.get("JIRA_TOKEN")
    return {"set": bool(key)}


@app.route("/tasks")
def get_tasks():
    tasks = load_tasks()
    return jsonify({"tasks": tasks})


@app.route("/tasks", methods=["POST"])
def create_task():
    data = request.get_json()
    if not data or "description" not in data:
        return jsonify({"error": "description is required"}), 400

    tasks = load_tasks()
    task_id = str(int(datetime.now().timestamp() * 1000))

    new_task = {
        "id": task_id,
        "description": data["description"],
        "agent": data.get("agent", ""),
        "source": data.get("source", "manual"),
        "jira_ticket": data.get("jira_ticket", ""),
        "created_at": datetime.now().isoformat(),
        "status": "Working",
        "session_id": None,
    }

    tasks.append(new_task)
    save_tasks(tasks)

    saved_config = load_config()
    execute_result = execute_task_via_api(task_id, new_task, saved_config)

    if isinstance(execute_result, tuple):
        return jsonify(
            {
                "success": True,
                "task": new_task,
                "execution_error": execute_result[0].get_json(),
            }
        ), execute_result[1]
    return jsonify(
        {"success": True, "task": new_task, "execution": execute_result.get_json()}
    )


@app.route("/tasks/<task_id>", methods=["DELETE"])
def delete_task(task_id):
    tasks = load_tasks()
    tasks = [t for t in tasks if t["id"] != task_id]
    save_tasks(tasks)

    if task_id in running_tasks:
        del running_tasks[task_id]

    return jsonify({"success": True})


@app.route("/agents")
def get_agents():
    working_dir = request.args.get("dir", "")

    try:
        result = subprocess.run(
            ["opencode", "agent", "list"],
            capture_output=True,
            text=True,
            timeout=30,
            cwd=working_dir if working_dir and os.path.exists(working_dir) else None,
        )

        agents = []
        if result.returncode == 0:
            lines = result.stdout.strip().split("\n")
            for line in lines:
                line = line.strip()
                if line and "(primary)" in line:
                    agent_name = line.split("(")[0].strip()
                    if agent_name:
                        agents.append(agent_name)

        return jsonify({"agents": agents})
    except Exception as e:
        return jsonify({"agents": [], "error": str(e)})


@app.route("/tasks/<task_id>/execute", methods=["POST"])
def execute_task(task_id):
    tasks = load_tasks()
    task = next((t for t in tasks if t["id"] == task_id), None)

    if not task:
        return jsonify({"error": "Task not found"}), 404

    saved_config = load_config()
    working_dir = saved_config.get("opencode_working_folder", "")
    description = task.get("description", "")
    agent = task.get("agent", "")

    use_api = request.args.get("api", "true").lower() == "true"

    if use_api:
        return execute_task_via_api(task_id, task, saved_config)

    if not working_dir:
        return jsonify(
            {"error": "No working directory configured in OpenCode settings"}
        ), 400

    if not os.path.exists(working_dir):
        return jsonify(
            {"error": f"Working directory does not exist: {working_dir}"}
        ), 400

    if not description:
        return jsonify({"error": "Task has no description"}), 400

    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        session_id = f"task_{task_id}_{timestamp}"
        log_file = os.path.join(LOGS_DIR, f"{session_id}.log")

        cmd_parts = [
            "opencode",
            "run",
            description,
            "--model",
            "minimax/MiniMax-M2.7-highspeed",
        ]
        if agent:
            cmd_parts.extend(["--agent", agent])
        cmd_parts.extend(["--title", session_id])

        cmd = " ".join(cmd_parts)

        proc = subprocess.Popen(
            cmd,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=working_dir,
        )

        running_tasks[task_id] = {
            "pid": proc.pid,
            "session_id": session_id,
            "log_file": log_file,
            "started_at": datetime.now().isoformat(),
            "description": description,
        }

        thread = threading.Thread(target=_stream_output, args=(proc, log_file, cmd))
        thread.daemon = True
        thread.start()

        return jsonify(
            {
                "success": True,
                "session_id": session_id,
                "pid": proc.pid,
                "log_file": log_file,
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def execute_task_via_api(task_id, task, saved_config):
    description = task.get("description", "")
    agent = task.get("agent", "")
    model_str = saved_config.get("opencode_model", "minimax/MiniMax-M2.7-highspeed")
    working_dir = saved_config.get("opencode_working_folder", "")

    if not description:
        return jsonify({"error": "Task has no description"}), 400

    opencode_session_id = None
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        session_id = f"task_{task_id}_{timestamp}"
        log_file = os.path.join(LOGS_DIR, f"{session_id}.log")

        auth = get_opencode_auth()
        headers = {"Content-Type": "application/json"}

        create_response = requests.post(
            f"{OPENCODE_SERVER_URL}/session",
            auth=auth if auth else None,
            headers=headers,
            json={"title": session_id},
            timeout=10,
        )

        if create_response.status_code != 200:
            return jsonify(
                {"error": "Failed to create session", "details": create_response.text}
            ), create_response.status_code

        opencode_session_id = create_response.json().get("id")

        prefix_prompt = """You are an INDEPENDENT AGENT operating autonomously. Follow these rules:

1. DO NOT ask questions to the user unless explicitly requested to do so.
2. Complete the task to the best of your knowledge and abilities without seeking confirmation.
3. If you encounter issues, try multiple approaches before reporting problems.
4. YOU ARE WORKING ON: """

        full_prompt = prefix_prompt + description

        message_body = {"parts": [{"type": "text", "text": full_prompt}]}
        if agent:
            message_body["agent"] = agent
        if model_str:
            message_body["model"] = format_model(model_str)

        send_response = requests.post(
            f"{OPENCODE_SERVER_URL}/session/{opencode_session_id}/prompt_async",
            auth=auth if auth else None,
            headers=headers,
            json=message_body,
            timeout=10,
        )

        running_tasks[task_id] = {
            "session_id": opencode_session_id,
            "log_file": log_file,
            "started_at": datetime.now().isoformat(),
            "description": description,
            "mode": "api",
        }

        with open(log_file, "w") as f:
            f.write(f"[{datetime.now().isoformat()}] Session: {opencode_session_id}\n")
            f.write(f"[{datetime.now().isoformat()}] Description: {description}\n")
            f.write(f"[{datetime.now().isoformat()}] Agent: {agent or 'default'}\n")
            f.write(f"[{datetime.now().isoformat()}] Model: {model_str}\n")
            f.write(f"[{datetime.now().isoformat()}] Prompt sent (async mode)\n")
            if send_response.status_code >= 400:
                f.write(
                    f"[{datetime.now().isoformat()}] Error ({send_response.status_code}): {send_response.text}\n"
                )

        tasks = load_tasks()
        for t in tasks:
            if t["id"] == task_id:
                t["session_id"] = opencode_session_id
                break
        save_tasks(tasks)

        if send_response.status_code >= 400:
            return jsonify(
                {"error": "Failed to send message", "details": send_response.text}
            ), send_response.status_code

        return jsonify(
            {
                "success": True,
                "session_id": opencode_session_id,
                "session_url": build_session_url(opencode_session_id, working_dir),
                "log_file": log_file,
            }
        )

    except requests.exceptions.Timeout:
        return jsonify(
            {"error": "Request timed out", "session_id": opencode_session_id}
        ), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/tasks/<task_id>/logs")
def get_task_logs(task_id):
    if task_id not in running_tasks:
        return jsonify({"error": "Task not running or logs not found"}), 404

    info = running_tasks[task_id]
    log_file = info["log_file"]

    if not os.path.exists(log_file):
        return jsonify({"logs": ""})

    try:
        with open(log_file, "r") as f:
            content = f.read()
        return jsonify({"logs": content})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/tasks/<task_id>/status", methods=["GET"])
def get_task_status(task_id):
    tasks = load_tasks()
    task = next((t for t in tasks if t["id"] == task_id), None)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    session_id = task.get("session_id")
    status = task.get("status", "Working")

    saved_config = load_config()
    working_dir = saved_config.get("opencode_working_folder", "")

    session_info = None
    if session_id:
        try:
            auth = get_opencode_auth()
            response = requests.get(
                f"{OPENCODE_SERVER_URL}/session/{session_id}",
                auth=auth if auth else None,
                timeout=5,
            )
            if response.status_code == 200:
                session_info = response.json()
        except Exception:
            pass

    return jsonify(
        {
            "task_id": task_id,
            "status": status,
            "session_id": session_id,
            "session_url": build_session_url(session_id, working_dir)
            if session_id
            else None,
            "session_info": session_info,
        }
    )


@app.route("/tasks/<task_id>/status", methods=["PATCH"])
def update_task_status(task_id):
    data = request.get_json()
    if not data or "status" not in data:
        return jsonify({"error": "status is required"}), 400

    tasks = load_tasks()
    task = next((t for t in tasks if t["id"] == task_id), None)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    valid_statuses = ["Working", "Creating Pull Request", "Updating Jira", "Done"]
    if data["status"] not in valid_statuses:
        return jsonify(
            {"error": f"Invalid status. Must be one of: {valid_statuses}"}
        ), 400

    task["status"] = data["status"]
    save_tasks(tasks)

    return jsonify({"success": True, "status": task["status"]})


def get_working_dir():
    saved_config = load_config()
    working_dir = saved_config.get("opencode_working_folder", "")
    if not working_dir or not os.path.exists(working_dir):
        return None
    git_check = subprocess.run(
        ["git", "rev-parse", "--is-inside-work-tree"],
        capture_output=True,
        text=True,
        timeout=5,
        cwd=working_dir,
    )
    if git_check.returncode != 0 or git_check.stdout.strip() != "true":
        return None
    return working_dir


def run_git_command(cmd, cwd=None):
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=30, cwd=cwd
        )
        return {
            "success": result.returncode == 0,
            "output": result.stdout.strip(),
            "error": result.stderr.strip(),
        }
    except Exception as e:
        return {"success": False, "output": "", "error": str(e)}


def run_git_command_list(cmd_list, cwd=None):
    try:
        result = subprocess.run(
            cmd_list, capture_output=True, text=True, timeout=30, cwd=cwd
        )
        return {
            "success": result.returncode == 0,
            "output": result.stdout.strip(),
            "error": result.stderr.strip(),
        }
    except Exception as e:
        return {"success": False, "output": "", "error": str(e)}


@app.route("/git/status")
def git_status():
    working_dir = get_working_dir()
    if not working_dir:
        return jsonify(
            {"error": "No working directory configured or not a git repository"}
        ), 400

    branch_result = run_git_command("git branch --show-current", cwd=working_dir)
    current_branch = branch_result["output"] if branch_result["success"] else "unknown"

    status_result = run_git_command("git status --porcelain", cwd=working_dir)
    uncommitted_files = (
        len(status_result["output"].splitlines()) if status_result["output"] else 0
    )

    return jsonify(
        {
            "working_dir": working_dir,
            "current_branch": current_branch,
            "uncommitted_files": uncommitted_files,
            "has_changes": uncommitted_files > 0,
        }
    )


@app.route("/git/pulls")
def git_pulls():
    working_dir = get_working_dir()
    if not working_dir:
        return jsonify(
            {"error": "No working directory configured or not a git repository"}
        ), 400

    result = run_git_command(
        "gh pr list --json number,title,state,url,headRefName --jq '.'", cwd=working_dir
    )
    if not result["success"]:
        return jsonify({"error": result["error"] or "Failed to list PRs"}), 500

    try:
        prs = json.loads(result["output"]) if result["output"] else []
        return jsonify({"pulls": prs, "count": len(prs)})
    except json.JSONDecodeError:
        return jsonify({"pulls": [], "count": 0})


@app.route("/git/branches")
def git_branches():
    working_dir = get_working_dir()
    if not working_dir:
        return jsonify(
            {"error": "No working directory configured or not a git repository"}
        ), 400

    result = run_git_command(
        "git branch -a --format='%(refname:short)'", cwd=working_dir
    )
    if not result["success"]:
        return jsonify({"error": result["error"] or "Failed to list branches"}), 500

    branches = [b.strip() for b in result["output"].split("\n") if b.strip()]
    return jsonify({"branches": branches})


@app.route("/git/switch-branch", methods=["POST"])
def git_switch_branch():
    data = request.get_json()
    if not data or "branch" not in data:
        return jsonify({"error": "branch is required"}), 400

    working_dir = get_working_dir()
    if not working_dir:
        return jsonify(
            {"error": "No working directory configured or not a git repository"}
        ), 400

    branch = data["branch"]
    result = run_git_command(f"git checkout {branch}", cwd=working_dir)
    if not result["success"]:
        return jsonify({"error": result["error"]}), 500

    return jsonify({"success": True, "branch": branch})


@app.route("/git/create-branch", methods=["POST"])
def git_create_branch():
    data = request.get_json()
    if not data or "name" not in data:
        return jsonify({"error": "name is required"}), 400

    working_dir = get_working_dir()
    if not working_dir:
        return jsonify(
            {"error": "No working directory configured or not a git repository"}
        ), 400

    name = data["name"]
    from_branch = data.get("from", "")

    cmd = (
        f"git checkout -b {name}"
        if not from_branch
        else f"git checkout -b {name} {from_branch}"
    )
    result = run_git_command(cmd, cwd=working_dir)
    if not result["success"]:
        return jsonify({"error": result["error"]}), 500

    return jsonify({"success": True, "branch": name})


def sanitize_branch_name(name):
    return re.sub(r"[^a-zA-Z0-9_\-/]", "", name)


@app.route("/git/create-pull", methods=["POST"])
def git_create_pull():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400

    working_dir = get_working_dir()
    if not working_dir:
        return jsonify(
            {"error": "No working directory configured or not a git repository"}
        ), 400

    title = data.get("title", "")
    body = data.get("body", "") or ""
    base = data.get("base", "main")

    if not title:
        return jsonify({"error": "title is required"}), 400

    branch_result = run_git_command("git branch --show-current", cwd=working_dir)
    head = branch_result["output"] if branch_result["success"] else ""

    if not head:
        return jsonify({"error": "Could not determine current branch"}), 400

    head = sanitize_branch_name(head)
    base = sanitize_branch_name(base)

    if head == "main":
        return jsonify({"error": "Cannot create PR from main branch"}), 400

    run_git_command("git fetch origin main", cwd=working_dir)
    status_result = run_git_command("git status --porcelain", cwd=working_dir)
    if status_result["output"]:
        run_git_command("git add -A", cwd=working_dir)
        commit_result = run_git_command_list(
            ["git", "commit", "-m", title], cwd=working_dir
        )
        if not commit_result["success"]:
            return jsonify(
                {"error": f"Failed to commit: {commit_result['error']}"}
            ), 500

    push_result = run_git_command_list(
        ["git", "push", "-u", "origin", head], cwd=working_dir
    )
    if not push_result["success"]:
        return jsonify({"error": f"Failed to push branch: {push_result['error']}"}), 500

    cmd_parts = [
        "gh",
        "pr",
        "create",
        "--title",
        title,
        "--body",
        body or title,
        "--base",
        base,
    ]

    result = run_git_command_list(cmd_parts, cwd=working_dir)
    if not result["success"]:
        return jsonify(
            {
                "error": result["error"] or "Failed to create PR",
                "output": result["output"],
                "head": head,
                "base": base,
            }
        ), 500

    return jsonify({"success": True, "url": result["output"]})


@app.route("/git/push", methods=["POST"])
def git_push():
    working_dir = get_working_dir()
    if not working_dir:
        return jsonify(
            {"error": "No working directory configured or not a git repository"}
        ), 400

    branch_result = run_git_command("git branch --show-current", cwd=working_dir)
    head = branch_result["output"] if branch_result["success"] else ""

    if not head:
        return jsonify({"error": "Could not determine current branch"}), 400

    head = sanitize_branch_name(head)

    if head == "main":
        return jsonify({"error": "Cannot push main branch"}), 400

    status_result = run_git_command("git status --porcelain", cwd=working_dir)
    if status_result["output"]:
        return jsonify(
            {"error": "You have uncommitted changes. Commit them first."}
        ), 400

    push_result = run_git_command_list(
        ["git", "push", "-u", "origin", head], cwd=working_dir
    )
    if not push_result["success"]:
        return jsonify({"error": f"Failed to push branch: {push_result['error']}"}), 500

    return jsonify({"success": True})


@app.route("/git/reset", methods=["POST"])
def git_reset():
    working_dir = get_working_dir()
    if not working_dir:
        return jsonify(
            {"error": "No working directory configured or not a git repository"}
        ), 400

    data = request.get_json() or {}
    discard = data.get("discard", False)
    base_branch = data.get("base", "main")

    branch_result = run_git_command("git branch --show-current", cwd=working_dir)
    current_branch = branch_result["output"] if branch_result["success"] else ""

    errors = []

    if discard:
        result = run_git_command(
            f"git checkout {current_branch} --force", cwd=working_dir
        )
    else:
        result = run_git_command("git stash", cwd=working_dir)
    if not result["success"] and "Nothing to stash" not in result.get("error", ""):
        errors.append(f"stash/discard: {result['error']}")

    result = run_git_command(f"git checkout {base_branch} --force", cwd=working_dir)
    if not result["success"]:
        errors.append(f"checkout: {result['error']}")
        return jsonify({"error": "; ".join(errors)}), 500

    result = run_git_command(f"git pull origin {base_branch}", cwd=working_dir)
    if not result["success"]:
        errors.append(f"pull: {result['error']}")

    return jsonify(
        {
            "success": len(errors) == 0,
            "errors": errors if errors else None,
            "branch": base_branch or "main",
        }
    )


if __name__ == "__main__":
    app.run(debug=True, port=5556)
