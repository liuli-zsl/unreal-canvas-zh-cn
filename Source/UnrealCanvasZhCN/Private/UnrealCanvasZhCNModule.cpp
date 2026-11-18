#include "HAL/FileManager.h"
#include "HAL/PlatformMisc.h"
#include "HAL/PlatformProcess.h"
#include "Interfaces/IPluginManager.h"
#include "Internationalization/ILocalizedTextSource.h"
#include "Internationalization/TextLocalizationManager.h"
#include "Internationalization/TextLocalizationResource.h"
#include "Logging/LogMacros.h"
#include "Misc/Paths.h"
#include "Modules/ModuleManager.h"

DEFINE_LOG_CATEGORY_STATIC(LogUnrealCanvasZhCN, Log, All);

namespace
{
constexpr TCHAR BundledRootsVariable[] = TEXT("MERLIN_BUNDLED_PLUGINS_ROOTS");
constexpr TCHAR FrontendId[] = TEXT("unreal-canvas-zh-cn");
constexpr TCHAR ExternalPathsVariable[] = TEXT("UE_ADDITIONAL_PLUGIN_PATHS");
constexpr TCHAR ShellId[] = TEXT("UnrealCanvasShellZhCN");

// The asset contains UE source hashes and our display strings. UE compares each
// hash against the host text, including after a culture change.
class FCanvasChineseSource final : public ILocalizedTextSource
{
public:
    FTextLocalizationResource Resource;

    int32 GetPriority() const override { return ELocalizedTextSourcePriority::High; }
    bool GetNativeCultureName(ELocalizedTextSourceCategory, FString&) override { return false; }

    void GetLocalizedCultureNames(ELocalizationLoadFlags Flags, TSet<FString>& Out) override
    {
        if (ShouldLoadEditor(Flags) || ShouldLoadEngine(Flags)) Out.Add(TEXT("zh-Hans"));
    }

    void LoadLocalizedResources(ELocalizationLoadFlags Flags, TArrayView<const FString> Cultures,
        FTextLocalizationResource&, FTextLocalizationResource& Out) override
    {
        if ((ShouldLoadEditor(Flags) || ShouldLoadEngine(Flags)) && Cultures.Contains(TEXT("zh-Hans")))
        {
            for (const auto& Pair : Resource.Entries)
            {
                Out.AddEntry(Pair.Key.GetNamespace(), Pair.Key.GetKey(), Pair.Value.SourceStringHash,
                    *Pair.Value.LocalizedString, -GetPriority(), Pair.Value.LocResID);
            }
        }
    }
};

void RegisterNativeText(const FString& ShellDir)
{
    const FString File = ShellDir / TEXT("Content/Localization") / ShellId / TEXT("zh-Hans") /
        (FString(ShellId) + TEXT(".locres"));
    const TSharedRef<FCanvasChineseSource> Source = MakeShared<FCanvasChineseSource>();
    if (Source->Resource.LoadFromFile(File, 0))
    {
        FTextLocalizationManager::Get().RegisterTextSource(Source);
        UE_LOG(LogUnrealCanvasZhCN, Display, TEXT("Registered %d native Canvas text patches from %s"),
            Source->Resource.Entries.Num(), *File);
    }
    else
    {
        UE_LOG(LogUnrealCanvasZhCN, Warning, TEXT("Missing native Canvas translations at %s"), *File);
    }
}
}

class FUnrealCanvasZhCNModule final : public IModuleInterface
{
public:
    virtual void StartupModule() override
    {
        IPluginManager& Manager = IPluginManager::Get();
        const TSharedPtr<IPlugin> Plugin = Manager.FindPlugin(TEXT("UnrealCanvasZhCN"));
        if (!Plugin || !Plugin->IsEnabled())
        {
            return;
        }

        const FString PluginDir = FPaths::ConvertRelativePathToFull(Plugin->GetBaseDir());
        const FString ShellDir = PluginDir / TEXT("Resources/NativeShell") / ShellId;
        RegisterNativeText(ShellDir);

        const FString Executable(FPlatformProcess::ExecutableName());
        if (Executable == TEXT("UnrealCanvasApp") || Executable.StartsWith(TEXT("UnrealCanvasApp-")))
        {
            return; // The editor already supplied the frontend search path to this process.
        }
        if (FPaths::FileExists(ShellDir / (FString(ShellId) + TEXT(".uplugin"))))
        {
            const FString CurrentPaths = FPlatformMisc::GetEnvironmentVariable(ExternalPathsVariable);
            TArray<FString> Entries;
            CurrentPaths.ParseIntoArray(Entries, TEXT(";"), true);
            if (PluginDir.Contains(TEXT(";")))
            {
                UE_LOG(LogUnrealCanvasZhCN, Warning, TEXT("Canvas App cannot discover native translations from an installation path containing ';': %s"), *PluginDir);
            }
            else
            {
                // The default-enabled shell descriptor requests the main plugin. The App uses
                // the same binary the project built, even when installed from a Git source ZIP.
                for (const FString& Directory : {PluginDir, ShellDir})
                {
                    if (!Entries.ContainsByPredicate([&Directory](const FString& Path) { return FPaths::IsSamePath(Path, Directory); }))
                    {
                        Entries.Add(Directory);
                        AddedPluginPaths.Add(Directory);
                    }
                }
                if (!AddedPluginPaths.IsEmpty())
                {
                    FPlatformMisc::SetEnvironmentVar(ExternalPathsVariable, *FString::Join(Entries, TEXT(";")));
                }
            }
        }
        else
        {
            UE_LOG(LogUnrealCanvasZhCN, Warning, TEXT("Incomplete native Canvas App plugin at %s"), *ShellDir);
        }

        const FString Root = FPaths::ConvertRelativePathToFull(Plugin->GetBaseDir() / TEXT("Resources/CanvasPlugins"));
        const FString Frontend = Root / FrontendId;
        TArray<FString> Folders;
        IFileManager::Get().FindFiles(Folders, *(Root / TEXT("*")), false, true);
        if (Folders.Num() != 1 || Folders[0] != FrontendId ||
            !FPaths::FileExists(Frontend / TEXT("manifest.json")) || !FPaths::FileExists(Frontend / TEXT("dist/index.js")))
        {
            UE_LOG(LogUnrealCanvasZhCN, Warning, TEXT("Incomplete Canvas language pack at %s. Reinstall the whole plugin folder, including Resources."), *Frontend);
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
        if (!AddedPluginPaths.IsEmpty())
        {
            const FString CurrentPaths = FPlatformMisc::GetEnvironmentVariable(ExternalPathsVariable);
            TArray<FString> Entries;
            CurrentPaths.ParseIntoArray(Entries, TEXT(";"), false);
            if (Entries.RemoveAll([this](const FString& Path) { return AddedPluginPaths.Contains(Path); }))
            {
                FPlatformMisc::SetEnvironmentVar(ExternalPathsVariable, *FString::Join(Entries, TEXT(";")));
            }
        }
        if (!InstalledRoots.IsEmpty() && FPlatformMisc::GetEnvironmentVariable(BundledRootsVariable) == InstalledRoots)
        {
            FPlatformMisc::SetEnvironmentVar(BundledRootsVariable, *PreviousRoots);
        }
    }

    virtual bool SupportsDynamicReloading() override { return false; }

private:
    FString PreviousRoots;
    FString InstalledRoots;
    TArray<FString> AddedPluginPaths;
};

IMPLEMENT_MODULE(FUnrealCanvasZhCNModule, UnrealCanvasZhCN)
