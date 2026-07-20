import os
import numpy as np
from ultralytics import YOLO


class DroneDetector:
    def __init__(self, model_path: str, confidence: float = 0.25):
        self.model = YOLO(model_path, task="detect")
        self.confidence = confidence

    def detect(self, frame) -> list:
        """
        Run YOLOv26 inference on a frame.
        Returns list of [x1, y1, x2, y2, conf, cls_id] for class 0 (drone).
        """
        results = self.model(frame, conf=self.confidence, verbose=False)
        dets = []
        if results and results[0].boxes is not None:
            boxes = results[0].boxes.xyxy.cpu().numpy()
            confs = results[0].boxes.conf.cpu().numpy()
            cls_ids = results[0].boxes.cls.cpu().numpy()
            for box, conf, cls_id in zip(boxes, confs, cls_ids):
                if int(cls_id) == 0:
                    dets.append([box[0], box[1], box[2], box[3], conf, cls_id])
        return dets
