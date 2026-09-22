"""
Storage utilities - simple JSON file persistence.

Data is stored in the configured DATA_DIR (default backend/data).
Note: Azure Functions Linux plan provides writable but ephemeral local storage,
so treat data here as best-effort persistence.
"""

import json
import logging
import os
import threading
from typing import Any, Dict, Optional

from config.settings import get_settings

logger = logging.getLogger(__name__)

_lock = threading.Lock()


def get_data_dir() -> str:
    return get_settings().app.data_dir


def _path(filename: str) -> str:
    return os.path.join(get_data_dir(), filename)


def read_json(filename: str, default: Optional[Any] = None) -> Any:
    """Read a JSON file from data dir. Returns default if missing/corrupt."""
    path = _path(filename)
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning("Failed to read %s: %s", path, e)
        return default


def write_json(filename: str, data: Any) -> bool:
    """Atomically write data to a JSON file in data dir."""
    path = _path(filename)
    tmp = path + ".tmp"
    try:
        with _lock:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, default=str)
            os.replace(tmp, path)
        return True
    except Exception as e:
        logger.error("Failed to write %s: %s", path, e)
        return False


def record_activity(text: str, status: str = "completed") -> None:
    """Append an entry to the activity log."""
    from datetime import datetime, timezone

    entries = read_json("activity.json", default=[])
    if not isinstance(entries, list):
        entries = []
    entries.append({
        "text": text,
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    write_json("activity.json", entries[-50:])