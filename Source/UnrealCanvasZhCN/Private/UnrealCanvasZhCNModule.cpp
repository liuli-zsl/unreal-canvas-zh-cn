#include "HAL/FileManager.h"
#include "HAL/PlatformMisc.h"
#include "Interfaces/IPluginManager.h"
#include "Logging/LogMacros.h"
#include "Misc/Paths.h"
#include "Modules/ModuleManager.h"

DEFINE_LOG_CATEGORY_STATIC(LogUnrealCanvasZhCN, Log, All);

namespace
{
constexpr TCHAR BundledRootsVariable[] = TEXT("MERLIN_BUNDLED_PLUGINS_ROOTS");
constexpr TCHAR FrontendId[] = TEXT("unreal-canvas-zh-cn");
}

class FUnrealCanvasZhCNModule final : public IModuleInterface
{
public:
    virtual void StartupModule() override
    {
        const TSharedPtr<IPlugin> Plugin = IPluginManager::Get().FindPlugin(TEXT("UnrealCanvasZhCN"));
        if (!Plugin)
        {
            return;
        }

        const FString Root = FPaths::ConvertRelativePathToFull(Plugin->GetBaseDir() / TEXT("Resources/CanvasPlugins"));
        const FString Frontend = Root / FrontendId;
        TArray<FString> Folders;
        IFileManager::Get().FindFiles(Folders, *(Root / TEXT("*")), false, true);
        if (Folders.Num() != 1 || Folders[0] != FrontendId ||
            !FPaths::FileExists(Frontend / TEXT("manifest.json")) || !FPaths::FileExists(Frontend / TEXT("dist/index.js")))
        {
            UE_LOG(LogUnrealCanvasZhCN, Warning, TEXT("Incomplete Canvas language pack at %s. Reinstall the plugin from the release ZIP."), *Frontend);
            return;
        }

        // Windows path lists support quoting a directory containing a semicolon.
        const FString Entry = Root.Contains(TEXT(";")) ? FString::Printf(TEXT("\"%s\""), *Root) : Root;
        PreviousRoots = FPlatformMisc::GetEnvironmentVariable(BundledRootsVariable);
        InstalledRoots = PreviousRoots.IsEmpty() ? Entry : PreviousRoots + TEXT(";") + Entry;
        // Bridge starts its server after engine initialization. Both it and the App
        // launched from Tools inherit this editor's process environment.
        FPlatformMisc::SetEnvironmentVar(BundledRootsVariable, *InstalledRoots);
        UE_LOG(LogUnrealCanvasZhCN, Display, TEXT("Registered Canvas language pack: %s"), *Frontend);
    }

    virtual void ShutdownModule() override
    {
        if (!InstalledRoots.IsEmpty() && FPlatformMisc::GetEnvironmentVariable(BundledRootsVariable) == InstalledRoots)
        {
            FPlatformMisc::SetEnvironmentVar(BundledRootsVariable, *PreviousRoots);
        }
    }

    virtual bool SupportsDynamicReloading() override { return false; }

private:
    FString PreviousRoots;
    FString InstalledRoots;
};

IMPLEMENT_MODULE(FUnrealCanvasZhCNModule, UnrealCanvasZhCN)
