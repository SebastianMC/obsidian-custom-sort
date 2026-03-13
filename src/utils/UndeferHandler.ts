import { App, Component, View, WorkspaceLeaf } from 'obsidian';

export class UndeferHandler extends Component {
    app: App;
    leaf: WorkspaceLeaf;
    view: View;
    callback?: (leaf: WorkspaceLeaf) => unknown;
    // Called when the deferred leaf is detached before being fully loaded
    onLeafDetach?: () => unknown;

    constructor(leaf: WorkspaceLeaf, callback: (leaf: WorkspaceLeaf) => unknown, onLeafDetach?: () => unknown) {
        super();
        this.app = leaf.view.app;
        this.leaf = leaf;
        this.view = leaf.view;
        this.callback = callback;
        this.onLeafDetach = onLeafDetach;

        this.view.addChild(this);
    }

    onload(): void {
        // Run the callback immediately if the leaf is not deferred
        if (!this.leaf.isDeferred) {
            this.view.removeChild(this);
            return;
        }

        // Detach the handler once the plugin has been disabled/unistalled
        this.registerEvent(this.app.workspace.on('custom-sort:plugin-unload', () => this.detach()));
    }

    onunload(): void {
        if (this.callback) this.runCallback();
    }

    // Detach the handler without invoking the callback
    detach(): void {
        delete this.callback;
        this.view.removeChild(this);
    }

    private async runCallback(): Promise<void> {
        // Run the callback after the actual view has been loaded
        await sleep(0);
        // Do not run the callback if the deferred view was unloaded
        // because of being closed
        if (
            !this.leaf.isDeferred &&
            this.leaf.parent &&
            this.leaf.view.getViewType() !== 'empty'
        ) {
            this.callback?.(this.leaf);
        } else {
            this.onLeafDetach?.();
        }
    }
}
