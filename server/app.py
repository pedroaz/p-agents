import os
import json
import subprocess
import threading
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


if __name__ == "__main__":
    app.run(debug=True, port=5556)
