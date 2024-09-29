import {
	TFolder,
	View,
	WorkspaceLeaf
} from "obsidian";

// Needed to support monkey-patching of functions of FileExplorerLeaf or FileExplorerView

declare module 'obsidian' {
	export interface ViewRegistry {
		viewByType: Record<string, (leaf: WorkspaceLeaf) => unknown>;
	}

	// undocumented internal interface - for experimental features
	export interface PluginInstance {
		id: string;
	}

	export type CommunityPluginId = string

	// undocumented internal interface - for experimental features
	export interface CommunityPlugin {
		manifest: {
			id: CommunityPluginId
		}
		_loaded: boolean
	}

	// undocumented internal interface - for experimental features
	export interface CommunityPlugins {
		enabledPlugins: Set<CommunityPluginId>
		plugins: {[key: CommunityPluginId]: CommunityPlugin}
	}

	export interface App {
		plugins: CommunityPlugins;
		internalPlugins: InternalPlugins; // undocumented internal API - for experimental features
		viewRegistry: ViewRegistry;
	}

	// undocumented internal interface - for experimental features
	export interface InstalledPlugin {
		enabled: boolean;
		instance: PluginInstance;
	}

	// undocumented internal interface - for experimental features
	export interface InternalPlugins {
		plugins: Record<string, InstalledPlugin>;
		getPluginById(id: string): InstalledPlugin;
	}

	interface FileExplorerFolder {
	}

	export interface FileExplorerView extends View {
		requestSort(): void;
		createFolderDom(folder: TFolder): FileExplorerFolder;
		getSortedFolderItems(sortedFolder: TFolder): any[];

		sortOrder: string
	}

	export interface FileExplorerLeaf extends WorkspaceLeaf {
		view: FileExplorerView
	}

	interface MenuItem {
		setSubmenu: () => Menu;
	}
}
