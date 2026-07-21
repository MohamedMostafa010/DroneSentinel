# Trained Model Weights — YOLOv26s

All four files are the **same fine-tuned DroneSentinel model** (single class: `drone`, trained at 960×960) — just exported to different formats for different runtimes. `best.pt` is the source; the rest are optimized/portable exports of it.

| File | Format | Precision | Size | Use it for |
|------|--------|:---------:|:----:|-----------|
| **`best.pt`** | PyTorch | FP32 | ~20 MB | The primary weights. This is what the app loads (shipped as `dronesentinel/backend/yolo26s.pt`). Runs anywhere PyTorch + CUDA is available. |
| **`best.onnx`** | ONNX | FP32 | ~38 MB | Framework-agnostic export — run with ONNX Runtime on CPU/GPU across platforms, or convert to other runtimes. |
| **`best_hf.engine`** | TensorRT | **FP16 (half)** | ~25 MB | Fastest inference on NVIDIA GPUs — half precision, smallest engine. |
| **`best_nf.engine`** | TensorRT | **FP32 (full)** | ~47 MB | Higher-precision TensorRT engine — full precision, larger. |

### Notes
- **Start with `best.pt`** — it's the most portable and is what the application uses out of the box.
- **The `.engine` files are hardware- and version-specific.** A TensorRT engine is built for a particular GPU + TensorRT/CUDA version, so it may not load on a different machine. If a `.engine` fails to load, rebuild it from `best.onnx` (or `best.pt`) on your own hardware.
- Metrics for this model: **mAP@50 = 97.8%**, **mAP@50–95 = 68.1%**, **Precision = 96.9%**, **Recall = 95.7%**, **Best F1 = 96.1%**.
