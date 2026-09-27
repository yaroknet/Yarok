// Stub hook — legacy fleet update tracking removed.
export interface ModuleCategoryUpdate {
  name: string;
  hasUpdates: boolean;
  count: number;
}
export interface ModuleUpdate {
  moduleName: string;
  hasUpdates: boolean;
  categories: ModuleCategoryUpdate[];
}

export function useModuleUpdates() {
  return {
    loading: false,
    getModuleUpdates: (_moduleName: string): ModuleUpdate | null => null,
    hasModuleUpdates: (_moduleName: string): boolean => false,
    hasCategoryUpdates: (_moduleName: string, _categoryName: string): boolean => false,
    markCategoryAsSeen: async (_moduleName: string, _categoryName: string) => {},
    markModuleAsViewed: async (_moduleName: string) => {},
    refresh: async () => {},
  };
}
