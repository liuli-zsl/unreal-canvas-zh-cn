"""Build a Chinese-only UE compact localization resource using the host's source hashes."""
from collections import defaultdict
from io import BytesIO
import os
from pathlib import Path
from struct import pack
from tempfile import NamedTemporaryFile

from catalog import OUTPUT, load_catalog, read_locres


def string(value):
    if value.isascii():
        encoded = value.encode("ascii") + bytes(1)
        return pack("<i", len(encoded)) + encoded
    encoded = value.encode("utf-16-le") + bytes(2)
    return pack("<i", -(len(encoded) // 2)) + encoded


def compile_resources():
    catalog = load_catalog()
    by_namespace = defaultdict(list)
    localized = {}
    for (namespace, key), (source_hash, chinese) in sorted(catalog.items()):
        index = localized.setdefault(chinese, len(localized))
        by_namespace[namespace].append((key, source_hash, index))

    table = BytesIO()
    table.write(pack("<I", len(by_namespace)))
    for namespace, entries in by_namespace.items():
        table.write(string(namespace))
        table.write(pack("<I", len(entries)))
        for key, source_hash, index in entries:
            table.write(string(key) + pack("<Ii", source_hash, index))
    magic = bytes.fromhex("0e147475674a03fc4a15909dc3377f1b")
    prefix = magic + pack("<Bq", 1, 25 + table.tell())
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(dir=OUTPUT.parent, suffix=".tmp", delete=False) as out:
        pending = Path(out.name)
    try:
        pending.write_bytes(prefix + table.getvalue() + pack("<I", len(localized)) +
                            b"".join(string(value) for value in localized))
        if read_locres(pending, catalog) != catalog:
            raise ValueError("Localization resource round-trip failed")
        os.replace(pending, OUTPUT)
    finally:
        pending.unlink(missing_ok=True)
    print(f"Compiled {len(catalog)} native entries for zh-Hans.")


if __name__ == "__main__":
    compile_resources()
