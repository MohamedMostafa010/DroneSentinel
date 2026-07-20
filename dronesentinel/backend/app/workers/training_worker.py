import subprocess
import sys
import os
import re
from threading import Thread, Event


class TrainingWorker:
    def __init__(self, config: dict, on_progress=None, on_finished=None):
        self.config = config
        self.on_progress = on_progress or (lambda msg: None)
        self.on_finished = on_finished or (lambda ok, msg: None)
        self._stop_event = Event()
        self._thread: Thread | None = None
        self._process = None

    def start(self):
        self._stop_event.clear()
        self._thread = Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self):
        self._stop_event.set()
        if self._process:
            self._process.terminate()

    def is_running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def _run(self):
        try:
            # Raw command mode — used for yolo val and other direct commands
            if self.config.get("_raw_cmd"):
                import shlex
                cmd = shlex.split(self.config["_raw_cmd"])
            # Resume mode — just pass last.pt with resume=True
            elif self.config.get("resume"):
                cmd = [
                    "yolo", "train",
                    f"model={self.config['model']}",
                    "resume=True",
                    "workers=0",
                ]
            else:
                cmd = [
                    "yolo", "train",
                    f"data={self.config['data_yaml']}",
                    f"model={self.config['model']}",
                    f"epochs={self.config.get('epochs', 30)}",
                    f"imgsz={self.config.get('imgsz', 640)}",
                    f"batch={self.config.get('batch', 16)}",
                ]
                # Optional params — only added if not None (user may have toggled them off)
                for key, default in [("patience", 15), ("workers", 0), ("lr0", 0.002), ("mosaic", 1.0), ("device", "0")]:
                    val = self.config.get(key)
                    if val is not None:
                        cmd.append(f"{key}={val}")
                cmd += [
                    f"name={self.config['name']}",
                    f"project={self.config['project']}",
                ]

            self.on_progress("Starting training...")
            # Suppress the pynvml FutureWarning in all child processes (dataloader workers etc.)
            # CUDA_LAUNCH_BLOCKING=1 prevents cuDNN stream mismatch errors on Windows with AMP
            _env = os.environ.copy()
            _env["PYTHONWARNINGS"] = "ignore::FutureWarning"
            self._process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                bufsize=1,
                env=_env,
            )

            for raw in self._process.stdout:
                if self._stop_event.is_set():
                    self._process.terminate()
                    break
                line = raw.decode('utf-8', errors='replace').strip()
                # Strip ANSI escape codes and carriage returns
                line = re.sub(r'\x1b\[[0-9;]*[A-Za-z]', '', line)
                line = re.sub(r'\r', '', line)
                if line:
                    self.on_progress(line)

            self._process.wait()

            if self._stop_event.is_set():
                self.on_finished(False, "Training stopped")
            elif self._process.returncode == 0:
                self.on_finished(True, "Training complete!")
            else:
                self.on_finished(
                    False,
                    f"Training failed (code {self._process.returncode})"
                )
        except Exception as e:
            self.on_finished(False, f"Error: {str(e)}")
