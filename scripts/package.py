"""Build or reuse the Win64 editor module and package the ready-to-enable UE plugin."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parents[1]
NAME = "UnrealCanvasZhCN"
DESCRIPTOR = f"{NAME}.uplugin"
DLL = f"Binaries/Win64/UnrealEditor-{NAME}.dll"
MODULES = "Binaries/Win64/UnrealEditor.modules"
RUNTIME = Path("Resources/CanvasPlugins/unreal-canvas-zh-cn")
SHELL_NAME = "UnrealCanvasShellZhCN"
SHELL = Path("Resources/NativeShell") / SHELL_NAME
SHELL_TARGET = SHELL / "Content/Localization" / SHELL_NAME
SHELL_RESOURCES = [
    SHELL / (SHELL_NAME + ".uplugin"), SHELL_TARGET / "zh-Hans" / (SHELL_NAME + ".locres"),
]
NATIVE_SOURCE = [
    f"Source/{NAME}/{NAME}.Build.cs",
    f"Source/{NAME}/Private/{NAME}Module.cpp",
    f"Source/{NAME}/Private/PluginVersion.rc",
]


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def install_binary(source, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.is_file() and destination.read_bytes() == source.read_bytes():
        return
    with tempfile.NamedTemporaryFile(dir=destination.parent, delete=False, suffix=".tmp") as file:
        pending = Path(file.name)
    try:
        shutil.copy2(source, pending)
        try:
            os.replace(pending, destination)
        except PermissionError:
            if os.name != "nt" or destination.suffix != ".dll" or not destination.is_file():
                raise
            # Windows may allow renaming an in-use DLL while denying replacement.
            # The running editor keeps its mapped copy until it exits normally.
            backups = ROOT / "Intermediate/PreviousModules"
            backups.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(dir=backups, suffix=".dll", delete=False) as backup:
                previous = Path(backup.name)
            try:
                os.replace(destination, previous)
            except OSError:
                previous.unlink()
                raise
            try:
                os.replace(pending, destination)
            except OSError:
                os.replace(previous, destination)
                raise
    finally:
        pending.unlink(missing_ok=True)


def build_native(engine):
    engine = engine.resolve()
    build = engine / "Engine/Build/BatchFiles/Build.bat"
    version = read_json(engine / "Engine/Build/Build.version")
    if (version["MajorVersion"], version["MinorVersion"]) != (5, 9):
        raise SystemExit("This release targets UE 5.9.")
    with tempfile.TemporaryDirectory(prefix="CanvasZhBuild-") as temporary:
        work = Path(temporary)
        project = work / "CanvasPluginBuild.uproject"
        project.write_text(json.dumps({"FileVersion": 3, "DisableEnginePluginsByDefault": True,
                                       "Plugins": [{"Name": NAME, "Enabled": True}]}), encoding="utf-8")
        source = work / "Plugins" / NAME
        for relative in [DESCRIPTOR, *NATIVE_SOURCE, RUNTIME / "manifest.json", RUNTIME / "dist/index.js"]:
            target = source / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / relative, target)
        # MSVC embeds __FILE__ in UE assertions. Strip the developer's engine and project roots.
        trim = " ".join(f'/d1trimfile:"{prefix.as_posix()}/"' for prefix in (engine, work))
        subprocess.run([str(build), "UnrealEditor", "Win64", "Development", f"-Project={project}",
                        f"-Plugin={source / DESCRIPTOR}", f"-CompilerArguments={trim}", "-OverrideBuildEnvironment",
                        "-NoHotReloadFromIDE", "-NoP4"], check=True)
        expected_id = read_json(engine / "Engine/Binaries/Win64/UnrealEditor.modules")["BuildId"]
        built = read_json(source / MODULES)
        if built["BuildId"] != expected_id or built["Modules"].get(NAME) != Path(DLL).name:
            raise SystemExit("UBT's module receipt does not match the selected editor.")
        for relative in (DLL, MODULES):
            install_binary(source / relative, ROOT / relative)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--engine", type=Path, help="Rebuild using this UE 5.9 installation before packaging.")
    args = parser.parse_args()
    descriptor = read_json(ROOT / DESCRIPTOR)
    version = descriptor["VersionName"]
    manifest = read_json(ROOT / "manifest.json")
    if manifest["id"] != RUNTIME.name or any(v != version for v in
            (manifest["version"], read_json(ROOT / "package.json")["version"],
             read_json(ROOT / "package-lock.json")["version"])):
        raise SystemExit("Plugin IDs or release versions are out of sync.")
    for relative in ("manifest.json", "dist/index.js"):
        if (ROOT / relative).read_bytes() != (ROOT / RUNTIME / relative).read_bytes():
            raise SystemExit("Embedded runtime is stale. Run npm run build.")
    subprocess.run([sys.executable, str(ROOT / "Tools/NativeShell/compile.py")], check=True)
    if args.engine:
        subprocess.run([sys.executable, str(ROOT / "scripts/verify-native-settings.py"),
                        "--engine", str(args.engine.resolve())], check=True)
        build_native(args.engine)
    if not (ROOT / MODULES).is_file() or not (ROOT / DLL).is_file():
        raise SystemExit("Missing native build. Run npm run package -- --engine <UE installation>.")
    receipt = read_json(ROOT / MODULES)
    if not receipt.get("BuildId") or receipt.get("Modules", {}).get(NAME) != Path(DLL).name:
        raise SystemExit("Invalid UnrealEditor.modules for the Win64 plugin.")
    members = [DESCRIPTOR, DLL, MODULES, *NATIVE_SOURCE, *SHELL_RESOURCES, RUNTIME / "manifest.json",
               RUNTIME / "dist/index.js", "README.md", "AGENTS.md", "CHANGELOG.md",
               "VERIFICATION.md",
               "Tools/Skills/ue-plugin-docs/SKILL.md", "Tools/Skills/ue-plugin-docs/agents/openai.yaml",
               "LICENSE", "NOTICE", "THIRD_PARTY.md"]
    output = ROOT / "output"
    output.mkdir(exist_ok=True)
    archive = output / f"{NAME}-{version}-UE5.9-Win64.zip"
    with tempfile.NamedTemporaryFile(dir=output, suffix=".tmp", delete=False) as file:
        pending = Path(file.name)
    try:
        with ZipFile(pending, "w", ZIP_DEFLATED) as package:
            for relative in members:
                # Identical member contents should retain identical ZIP metadata.
                entry = ZipInfo((Path(NAME) / relative).as_posix())
                entry.create_system = 3
                entry.external_attr = 0o100644 << 16
                package.writestr(entry, (ROOT / relative).read_bytes(), compress_type=ZIP_DEFLATED)
        with ZipFile(pending) as package:
            if package.testzip() is not None:
                raise SystemExit("ZIP integrity check failed.")
        os.replace(pending, archive)
    finally:
        pending.unlink(missing_ok=True)
    print(f"{archive}\nEditor BuildId {receipt['BuildId']}\nSHA256 {hashlib.sha256(archive.read_bytes()).hexdigest()}")


if __name__ == "__main__":
    main()
