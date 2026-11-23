"""Compare native IDs and format placeholders to the developer's licensed UE installation."""
import argparse
from collections import Counter
from pathlib import Path
import re
from zlib import crc32

from catalog import OUTPUT, load_catalog, read_locres


def verify(engine):
    catalog = load_catalog()
    official = {}
    for target in ("Editor", "Engine", "PropertyNames", "ToolTips"):
        directory = engine / "Engine/Content/Localization" / target
        source = read_locres(directory / "en" / (target + ".locres"), catalog)
        existing = read_locres(directory / "zh-Hans" / (target + ".locres"), catalog)
        for key, pair in source.items():
            if existing.get(key) != pair:
                raise ValueError(f"Host translation available or changed for {key}; review the overlay")
            official[key] = pair
    header = (engine / "Engine/Plugins/Developer/UnrealCanvas/UnrealCanvasBridge/Source"
              / "UnrealCanvasBridge/Public/UnrealCanvasBridgeSettings.h").read_text(encoding="utf-8-sig")
    for enum, body in re.findall(r"enum class (\w+)\s*:\s*uint8\s*\{([^}]+)\}", header):
        for name, value in re.findall(r'(\w+)\s+UMETA\(DisplayName="([^"]+)"\)', body):
            key = "UObjectDisplayNames", f"{enum}.{name}"
            if key in catalog:
                official[key] = crc32(value.encode("utf-32-le")), value
    for key, (source_hash, chinese) in catalog.items():
        if key not in official or official[key][0] != source_hash:
            raise ValueError(f"Unknown or changed UE text: {key}")
        tokens = r"\{(?:\w+)\}"
        if Counter(re.findall(tokens, official[key][1])) != Counter(re.findall(tokens, chinese)):
            raise ValueError(f"Format placeholders differ for {key}")
    if read_locres(OUTPUT, catalog) != catalog:
        raise ValueError("The compiled zh-Hans resource differs from the catalog")
    print(f"Verified {len(catalog)} source hashes, placeholders and compiled translations against UE.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--engine", type=Path, required=True)
    verify(parser.parse_args().engine.resolve())
