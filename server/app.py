import os
import subprocess
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


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
    config = {
        "opencode": check_opencode(),
        "docker": check_docker(),
        "jira_api_key": check_jira_api_key(),
        "env_file": check_env_file(),
    }
    return jsonify(config)


if __name__ == "__main__":
    app.run(debug=True, port=5556)
