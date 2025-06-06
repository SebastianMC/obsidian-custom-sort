import {App, normalizePath, PluginSettingTab, sanitizeHTMLToDom, Setting} from "obsidian";
import {groupNameForPath} from "./utils/BookmarksCorePluginSignature";
import CustomSortPlugin from "./main";

export interface CustomSortPluginSettings {
    additionalSortspecFile: string
    indexNoteNameForFolderNotes: string
    suspended: boolean
    statusBarEntryEnabled: boolean
    notificationsEnabled: boolean
    mobileNotificationsEnabled: boolean
    automaticBookmarksIntegration: boolean
    customSortContextSubmenu: boolean
    bookmarksContextMenus: boolean
    bookmarksGroupToConsumeAsOrderingReference: string
    delayForInitialApplication: number // miliseconds
}

const MILIS = 1000
const DEFAULT_DELAY_SECONDS = 1
const DELAY_MIN_SECONDS = 0
const DELAY_MAX_SECONDS = 30
const DEFAULT_DELAY = DEFAULT_DELAY_SECONDS * MILIS

export const DEFAULT_SETTINGS: CustomSortPluginSettings = {
    additionalSortspecFile: '',
    indexNoteNameForFolderNotes: '',
    suspended: true,  // if false by default, it would be hard to handle the auto-parse after plugin install
    statusBarEntryEnabled: true,
    notificationsEnabled: true,
    mobileNotificationsEnabled: false,
    customSortContextSubmenu: true,
    automaticBookmarksIntegration: false,
    bookmarksContextMenus: false,
    bookmarksGroupToConsumeAsOrderingReference: 'sortspec',
    delayForInitialApplication: DEFAULT_DELAY
}

// On API 1.2.x+ enable the bookmarks integration by default
export const DEFAULT_SETTING_FOR_1_2_0_UP: Partial<CustomSortPluginSettings> = {
    automaticBookmarksIntegration: true,
    bookmarksContextMenus: true
}

const pathToFlatString = (path: string): string => {
    return path.replace(/\//g,'_').replace(/\\/g, '_')
}

export class CustomSortSettingTab extends PluginSettingTab {
    plugin: CustomSortPlugin;

    constructor(app: App, plugin: CustomSortPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        const delayDescr: DocumentFragment = sanitizeHTMLToDom(
            'Number of seconds to wait before applying custom ordering on plugin / app start.'
            + '<br>'
            + 'For large vaults, multi-plugin vaults or on mobile the value might need to be increased if you encounter issues with auto-applying'
            + ' of custom ordering on start. The delay gives Obsidian additional time to sync notes from cloud storages, to populate notes metadata caches,'
            + ' etc.'
            + '<br>'
            + 'At the same time if your vault is relatively small or only used on desktop, or not synced with other copies,'
            + ' decreasing the delay to 0 could be a safe option.'
            + '<br>'
            + `Min: ${DELAY_MIN_SECONDS} sec., max. ${DELAY_MAX_SECONDS} sec.`
        )

        new Setting(containerEl)
            .setName('Delay for initial automatic application of custom ordering')
            .setDesc(delayDescr)
            .addText(text => text
                .setValue(`${this.plugin.settings.delayForInitialApplication/MILIS}`)
                .onChange(async (value) => {
                    let delayS = parseFloat(value)
                    delayS = (Number.isNaN(delayS) || !Number.isFinite((delayS))) ? DEFAULT_DELAY_SECONDS : (delayS < DELAY_MIN_SECONDS ? DELAY_MIN_SECONDS :(delayS > DELAY_MAX_SECONDS ? DELAY_MAX_SECONDS : delayS))
                    delayS = Math.round(delayS*10) / 10  // allow values like 0.2
                    this.plugin.settings.delayForInitialApplication = delayS * MILIS
                    await this.plugin.saveSettings()
                }))

        const additionalSortspecFileDescr: DocumentFragment = sanitizeHTMLToDom(
            'A note name or note path to scan (YAML frontmatter) for sorting specification in addition to the `sortspec` notes and Folder Notes.'
            + '<br>'
            + ' The `.md` filename suffix is optional.'
            + '<br>'
            + '<p>NOTE: After updating this setting remember to refresh the custom sorting via clicking on the ribbon icon or via the <b>sort-on</b> command'
            + ' or by restarting Obsidian or reloading the vault</p>'
        )

        new Setting(containerEl)
            .setName('Path or name of additional note(s) containing sorting specification')
            .setDesc(additionalSortspecFileDescr)
            .addText(text => text
                .setPlaceholder('e.g. sorting-configuration')
                .setValue(this.plugin.settings.additionalSortspecFile)
                .onChange(async (value) => {
                    this.plugin.settings.additionalSortspecFile = value.trim() ? normalizePath(value) : '';
                    await this.plugin.saveSettings();
                }));

        const indexNoteNameDescr: DocumentFragment = sanitizeHTMLToDom(
            'If you employ the <i>Index-File based</i> approach to folder notes (as documented in '
            + '<a href="https://github.com/aidenlx/alx-folder-note/wiki/folder-note-pref"'
            + '>Aidenlx Folder Note preferences</a>'
            + ') enter here the index note name, e.g. <b>_about_</b> or <b>index</b>'
            + '<br>'
            + ' The `.md` filename suffix is optional.'
            + '<br>'
            + 'This will tell the plugin to read sorting specs and also folders metadata from these files.'
            + '<br>'
            + 'The <i>Inside Folder, with Same Name Recommended</i> mode of Folder Notes is handled automatically, no additional configuration needed.'
            + '</p>'
            + '<p>NOTE: After updating this setting remember to refresh the custom sorting via clicking on the ribbon icon or via the <b>sort-on</b> command'
            + ' or by restarting Obsidian or reloading the vault</p>'
        )

        new Setting(containerEl)
            .setName('Name of index note (Folder Notes support)')
            .setDesc(indexNoteNameDescr)
            .addText(text => text
                .setPlaceholder('e.g. _about_ or index')
                .setValue(this.plugin.settings.indexNoteNameForFolderNotes)
                .onChange(async (value) => {
                    this.plugin.settings.indexNoteNameForFolderNotes = value.trim() ? normalizePath(value) : '';
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Enable the status bar entry')
            .setDesc('The status bar entry shows the label `Custom sort:ON` or `Custom sort:OFF`, representing the current state of the plugin.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.statusBarEntryEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.statusBarEntryEnabled = value;
                    if (value) {
                        // Enabling
                        if (this.plugin.statusBarItemEl) {
                            // for sanity
                            this.plugin.statusBarItemEl.detach()
                        }
                        this.plugin.statusBarItemEl =  this.plugin.addStatusBarItem();
                        this.plugin.updateStatusBar()

                    } else { // disabling
                        if (this.plugin.statusBarItemEl) {
                            this.plugin.statusBarItemEl.detach()
                        }
                    }
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Enable notifications of plugin state changes')
            .setDesc('The plugin can show notifications about its state changes: e.g. when successfully parsed and applied'
                + ' the custom sorting specification, or, when the parsing failed. If the notifications are disabled,'
                + ' the only indicator of plugin state is the ribbon button icon. The developer console presents the parsing'
                + ' error messages regardless if the notifications are enabled or not.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.notificationsEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.notificationsEnabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Enable notifications of plugin state changes for mobile devices only')
            .setDesc('See above.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.mobileNotificationsEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.mobileNotificationsEnabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Enable File Explorer context submenu`Custom sort:`')
            .setDesc('Gives access to operations relevant for custom sorting, e.g. applying custom sorting.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.customSortContextSubmenu)
                .onChange(async (value) => {
                    this.plugin.settings.customSortContextSubmenu = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h2', {text: 'Bookmarks integration'});
        const bookmarksIntegrationDescription: DocumentFragment = sanitizeHTMLToDom(
            'If enabled, order of files and folders in File Explorer will reflect the order '
            + 'of bookmarked items in the bookmarks (core plugin) view. Automatically, without any '
            + 'need for sorting configuration. At the same time, it integrates seamlessly with'
            + ' <pre style="display: inline;">sorting-spec:</pre> configurations and they can nicely cooperate.'
            + '<br>'
            + '<p>To separate regular bookmarks from the bookmarks created for sorting, you can put '
            + 'the latter in a separate dedicated bookmarks group. The default name of the group is '
            + "'<i>" + DEFAULT_SETTINGS.bookmarksGroupToConsumeAsOrderingReference + "</i>' "
            + 'and you can change the group name in the configuration field below.'
            + '<br>'
            + 'If left empty, all the bookmarked items will be used to impose the order in File Explorer.</p>'
            + '<p>More information on this functionality in the '
            + '<a href="https://github.com/SebastianMC/obsidian-custom-sort/blob/master/docs/manual.md#bookmarks-plugin-integration">'
            + 'manual</a> of this custom-sort plugin.'
            + '</p>'
        )

        new Setting(containerEl)
            .setName('Automatic integration with core Bookmarks plugin (for indirect drag & drop ordering)')
            .setDesc(bookmarksIntegrationDescription)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.automaticBookmarksIntegration)
                .onChange(async (value) => {
                    this.plugin.settings.automaticBookmarksIntegration = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Name of the group in Bookmarks from which to read the order of items')
            .setDesc('See above.')
            .addText(text => text
                .setPlaceholder('e.g. Group for sorting')
                .setValue(this.plugin.settings.bookmarksGroupToConsumeAsOrderingReference)
                .onChange(async (value) => {
                    value = groupNameForPath(value.trim()).trim()
                    this.plugin.settings.bookmarksGroupToConsumeAsOrderingReference = value ? pathToFlatString(normalizePath(value)) : '';
                    await this.plugin.saveSettings();
                }));

        const bookmarksIntegrationContextMenusDescription: DocumentFragment = sanitizeHTMLToDom(
            'Enable <i>Custom-sort: bookmark for sorting</i> and <i>Custom-sort: bookmark+siblings for sorting</i> (and related) entries '
            + 'in context menu in File Explorer'
        )
        new Setting(containerEl)
            .setName('Context menus for Bookmarks integration')
            .setDesc(bookmarksIntegrationContextMenusDescription)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.bookmarksContextMenus)
                .onChange(async (value) => {
                    this.plugin.settings.bookmarksContextMenus = value;
                    if (value) {
                        this.plugin.settings.customSortContextSubmenu = true; // automatically enable custom sort context submenu
                    }
                    await this.plugin.saveSettings();
                }))
    }
}
