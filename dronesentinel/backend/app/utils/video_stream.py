import cv2
import queue
from typing import Generator


def frame_to_jpeg_bytes(frame, quality: int = 50) -> bytes:
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return buf.tobytes()


def mjpeg_generator(frame_queue: queue.Queue, quality: int = 50) -> Generator[bytes, None, None]:
    """
    Yield multipart MJPEG frames from the queue.
    Simple and clean — no placeholders, no fake frames.
    Blocks waiting for real frames. Ends cleanly on None sentinel.
    """
    while True:
        try:
            frame = frame_queue.get(timeout=2.0)
            if frame is None:
                break  # clean stop signal
            jpg = frame_to_jpeg_bytes(frame, quality)
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n"
            )
        except queue.Empty:
            continue  # just wait — no placeholder, no fake frames
        except GeneratorExit:
            break
