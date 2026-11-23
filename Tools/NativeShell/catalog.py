"""Read the Chinese overlay metadata and the UE compact localization resource formats."""
from io import BytesIO
import json
from pathlib import Path
from struct import unpack

ROOT = Path(__file__).resolve().parents[2]
TARGET = "UnrealCanvasShellZhCN"
OUTPUT = ROOT / "Content/Localization" / TARGET / "zh-Hans" / (TARGET + ".locres")


def load_catalog():
    entries = {}
    for path in sorted(Path(__file__).parent.glob("*.json")):
        for namespace, messages in json.loads(path.read_text(encoding="utf-8")).items():
            for key, (source_hash, chinese) in messages.items():
                identity = (namespace, key)
                if identity in entries or len(source_hash) != 8 or not chinese:
                    raise ValueError(f"Duplicate or invalid entry {identity} in {path.name}")
                entries[identity] = (int(source_hash, 16), chinese)
    return entries


def read_locres(path, wanted):
    """Read named entries from UE's Compact and Optimized .locres formats (versions 1–3)."""
    file = BytesIO(path.read_bytes())

    def read_number(fmt):
        return unpack(fmt, file.read(8 if fmt == "<q" else 4))[0]

    def read_string(decode=True):
        count = read_number("<i")
        if count == 0:
            return ""
        length = count if count > 0 else -count * 2
        if not decode:
            file.seek(length, 1)
            return ""
        raw = file.read(length)
        return raw[:-1].decode("utf-8") if count > 0 else raw[:-2].decode("utf-16-le")

    if file.read(16) != bytes.fromhex("0e147475674a03fc4a15909dc3377f1b"):
        raise ValueError(f"Unsupported locres header in {path}")
    version = file.read(1)[0]
    if version not in (1, 2, 3):
        raise ValueError(f"Unsupported locres version {version} in {path}")
    optimized = version >= 2
    strings_offset = read_number("<q")
    if optimized:
        file.seek(4, 1)  # Total number of entries.
    namespaces = {ns for ns, _ in wanted}
    selected = {}
    for _ in range(read_number("<I")):
        if optimized:
            file.seek(4, 1)  # Precomputed namespace hash.
        namespace = read_string()
        for _ in range(read_number("<I")):
            if optimized:
                file.seek(4, 1)  # Precomputed key hash.
            key = read_string(namespace in namespaces)
            source_hash, index = unpack("<Ii", file.read(8))
            if (namespace, key) in wanted:
                selected[namespace, key] = source_hash, index
    if file.tell() != strings_offset:
        raise ValueError(f"Unexpected string table offset in {path}")
    values = {}
    indices = {index for _, index in selected.values()}
    for index in range(read_number("<I")):
        value = read_string(index in indices)
        if index in indices:
            values[index] = value
        if optimized:
            file.seek(4, 1)  # String reference count.
    return {key: (crc, values[index]) for key, (crc, index) in selected.items()}
