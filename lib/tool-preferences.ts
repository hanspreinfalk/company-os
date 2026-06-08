export type ToolkitToolPreferences = {
  toolkitSlug: string;
  disabledToolSlugs: string[];
  initialized: boolean;
};

export function isToolEnabled(
  toolSlug: string,
  preference: ToolkitToolPreferences | undefined,
  recommendedToolSlugs: string[] = []
): boolean {
  if (!preference?.initialized) {
    if (recommendedToolSlugs.length === 0) {
      return true;
    }

    return recommendedToolSlugs.includes(toolSlug);
  }

  return !preference.disabledToolSlugs.includes(toolSlug);
}

export function getToolkitPreference(
  preferences: ToolkitToolPreferences[] | undefined,
  toolkitSlug: string
): ToolkitToolPreferences | undefined {
  return preferences?.find((preference) => preference.toolkitSlug === toolkitSlug);
}

export function getDisabledToolSlugs(
  preferences: ToolkitToolPreferences[] | undefined,
  toolkitSlug: string
): string[] {
  return getToolkitPreference(preferences, toolkitSlug)?.disabledToolSlugs ?? [];
}

export function isPreferenceInitialized(
  preferences: ToolkitToolPreferences[] | undefined,
  toolkitSlug: string
): boolean {
  return getToolkitPreference(preferences, toolkitSlug)?.initialized ?? false;
}

export function countEnabledTools(
  toolSlugs: string[],
  preference: ToolkitToolPreferences | undefined,
  recommendedToolSlugs: string[] = []
): number {
  return toolSlugs.filter((slug) =>
    isToolEnabled(slug, preference, recommendedToolSlugs)
  ).length;
}

export function getEnabledToolSlugs(
  toolSlugs: string[],
  preference: ToolkitToolPreferences | undefined,
  recommendedToolSlugs: string[] = []
): string[] {
  return toolSlugs.filter((slug) =>
    isToolEnabled(slug, preference, recommendedToolSlugs)
  );
}
