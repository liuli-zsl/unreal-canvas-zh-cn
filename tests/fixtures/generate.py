"""Generate the viewer's test triangle and two-second silent color clip from scratch."""
import json
from pathlib import Path
import struct


ROOT = Path(__file__).resolve().parent


def write_triangle():
    # Three unindexed vertices; a single joint controls all three.
    positions = ((-0.5, 0, 0), (0.5, 0, 0), (0, 1, 0))
    vertices = b"".join(struct.pack("<3f", *p) for p in positions)
    joints = bytes(12)
    weights = bytes([255, 0, 0, 0] * 3)
    geometry = vertices + joints + weights
    gltf = {
        "asset": {"version": "2.0", "generator": "unreal-canvas-zh-cn viewer test"},
        "scene": 0, "scenes": [{"nodes": [0, 1]}],
        "nodes": [{"name": "Fixture joint"}, {"mesh": 0, "skin": 0}],
        "skins": [{"joints": [0], "skeleton": 0}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "JOINTS_0": 1, "WEIGHTS_0": 2}}]}],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "type": "VEC3", "count": 3,
             "min": [-0.5, 0, 0], "max": [0.5, 1, 0]},
            {"bufferView": 1, "componentType": 5121, "type": "VEC4", "count": 3},
            {"bufferView": 2, "componentType": 5121, "type": "VEC4", "count": 3, "normalized": True},
        ],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(vertices), "target": 34962},
            {"buffer": 0, "byteOffset": len(vertices), "byteLength": len(joints), "target": 34962},
            {"buffer": 0, "byteOffset": len(vertices) + len(joints), "byteLength": len(weights), "target": 34962},
        ],
        "buffers": [{"byteLength": len(geometry)}],
    }
    metadata = json.dumps(gltf, separators=(",", ":")).encode("ascii")
    metadata += b" " * (-len(metadata) % 4)
    chunks = struct.pack("<I4s", len(metadata), b"JSON") + metadata
    chunks += struct.pack("<I4s", len(geometry), b"BIN\0") + geometry
    (ROOT / "viewer.glb").write_bytes(struct.pack("<4sII", b"glTF", 2, 12 + len(chunks)) + chunks)


def write_clip():
    import cv2
    import numpy as np

    clip = ROOT / "viewer.webm"
    width, height, fps = 48, 32, 10
    writer = cv2.VideoWriter(str(clip), cv2.VideoWriter_fourcc(*"VP80"), fps, (width, height))
    if not writer.isOpened():
        raise RuntimeError("A VP8-capable OpenCV build is required to regenerate viewer.webm.")
    try:
        for frame_number in range(fps * 2):
            frame = np.full((height, width, 3), (48, 80, 116), dtype=np.uint8)
            x = (frame_number * 2) % (width - 6)
            frame[:, x:x + 6] = (185, 211, 245)
            writer.write(frame)
    finally:
        writer.release()


if __name__ == "__main__":
    write_triangle()
    write_clip()
