using UnrealBuildTool;

public class UnrealCanvasZhCN : ModuleRules
{
    public UnrealCanvasZhCN(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PrivateDependencyModuleNames.AddRange(new[] { "Core", "Projects" });
    }
}
