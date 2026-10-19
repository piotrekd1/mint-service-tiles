// Copyright (C) 2026 piotrek-d1 <piotrek-d1@o2.pl>
// SPDX-License-Identifier: GPL-3.0-or-later

const Desklet = imports.ui.desklet;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const ModalDialog = imports.ui.modalDialog;
const Tooltips = imports.ui.tooltips;
const Pango = imports.gi.Pango;
const ByteArray = imports.byteArray;

const BINARY = GLib.build_filenamev([GLib.get_home_dir(), '.local', 'bin', 'mint-service-check']);

function ServiceTiles(metadata, deskletId) {
    this._init(metadata, deskletId);
}

ServiceTiles.prototype = {
    __proto__: Desklet.Desklet.prototype,

    _init(metadata, deskletId) {
        Desklet.Desklet.prototype._init.call(this, metadata, deskletId);
        this._gone = false;
        // Decoration visibility is applied after the desklet content is built.
        this._entries = new Map();
        this._alarm = null;
        this._tickId = 0;
        this._activeTooltip = null;
        this._tooltipTiles = [];
        this._rebuildQueued = false;
        this._lastVisualSignature = null;
        this._settings = new Settings.DeskletSettings(this, metadata.uuid, deskletId);
        const keys = [['services','services'],['tile-size','tileSize'],['columns','columns'],['alarm-window','alarmWindow'],['background-color','backgroundColor'],['show-title','showTitle'],['tile-margin','tileMargin'],['tile-gap','tileGap']];
        for (const [key, prop] of keys) {
            this._settings.bindProperty(Settings.BindingDirection.IN, key, prop, () => { this._queueRebuild(); }, null);
        }
        // The stock Cinnamon desklet right-click menu is owned by the desklet.
        // Register actions once (not on every redraw), retaining Cinnamon's
        // standard menu actions such as Remove and Configure.
        // Use Cinnamon's standard context menu only (Configure / Remove).
        this.language = this._detectLanguage(metadata.path);
        this._translations = this._loadTranslations(metadata.path);
        this._readSettings();
        this._queueRebuild();
        this._tickId = Mainloop.timeout_add_seconds(1, () => { this._tick(); return !this._gone; });
    },

    _queueRebuild() {
        if (this._gone || this._rebuildQueued) return;
        this._rebuildQueued = true;
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._rebuildQueued = false;
            if (!this._gone) this._rebuild();
            return GLib.SOURCE_REMOVE;
        });
    },

    _readSettings() {
        // Use native GSettings bindings for the current values. The disk copy is
        // consulted only when it actually changes, by _reloadFileSettings().
        const map = [['services','services'],['tile-size','tileSize'],
            ['columns','columns'],
            ['alarm-window','alarmWindow'],['background-color','backgroundColor'],
            ['show-title','showTitle'],['tile-margin','tileMargin'],['tile-gap','tileGap']];
        for (const [key, property] of map) {
            try {
                const value = this._settings.getValue(key);
                if (value !== undefined && value !== null) this[property] = value;
            } catch (e) { global.logError(e); }
        }
    },

    _visualSignature() {
        return JSON.stringify([
            this.tileSize, this.columns, this.language, this.backgroundColor,
            this.showTitle, this.tileMargin, this.tileGap, this.alarmWindow, this.services
        ]);
    },

    _detectLanguage(path) {
        // Try LANGUAGE / LC_ALL / LC_MESSAGES / LANG in the order GLib provides.
        // Strip region, encoding and modifiers; use English for unsupported locales.
        for (const name of GLib.get_language_names()) {
            const code = String(name).split(/[_.@]/)[0].toLowerCase();
            if (code === 'c' || code === 'posix') continue;
            const normalized = code === 'no' || code === 'nn' ? 'nb' : code;
            const file = Gio.File.new_for_path(GLib.build_filenamev([path, 'locale', normalized + '.json']));
            if (file.query_exists(null)) return normalized;
        }
        return 'en';
    },

    _loadTranslations(path) {
        // Each UI translation is loaded from an actual locale file. If the
        // system's locale isn't supported, fall back to English.
        try {
            const file = Gio.File.new_for_path(GLib.build_filenamev([path, 'locale', this.language + '.json']));
            const [ok, bytes] = file.load_contents(null);
            if (ok) return JSON.parse(ByteArray.toString(bytes)).ui || {};
        } catch (e) { global.logError(e); }
        return {};
    },

    _t(pl, en) { return this._translations[en] || (this.language === 'pl' ? pl : en); },

    _applyDecorations() {
        // Cinnamon supplies header/border decoration, outside setContent().
        // Avoid touching the global desktop preference (other desklets use it).
        const show = false; // Native Cinnamon decorations must always be suppressed.
        if (this.setHeader) this.setHeader('');
        if (this._header) { if (show) this._header.show(); else this._header.hide(); }
        if (this._headerBin) { if (show) this._headerBin.show(); else this._headerBin.hide(); }
        if (this._headerLabel) { if (show) this._headerLabel.show(); else this._headerLabel.hide(); }
    },

    _normalized() {
        const all = Array.isArray(this.services) ? this.services : [];
        return all.map((row, index) => {
            const target = String(row.target || '').trim();
            const mode = String(row.mode || 'http').trim().toLowerCase();
            const interval = Number(row.interval);
            // Stable identifier tied to normalized address and mode, independent of list order.
            const key = mode + '\u0000' + target;
            let hash = 2166136261;
            for (let i = 0; i < key.length; i++) { hash ^= key.charCodeAt(i); hash = Math.imul(hash, 16777619); }
            return { id: 'service_' + (hash >>> 0).toString(16), name: String(row.name || target || ('#' + (index + 1))), target,
                mode, interval: Number.isFinite(interval) ? Math.max(5, Math.min(86400, Math.floor(interval))) : 60 };
        }).filter(row => row.target && (row.mode === 'http' || row.mode === 'ping'));
    },

    _tileText(name, size) {
        const clean = String(name || '').trim();
        // At small sizes show initials; never let the label grow outside a tile.
        const capacity = Math.max(1, Math.floor((size - 8) / Math.max(6, Math.min(12, size * 0.22))));
        if (clean.length <= capacity) return clean;
        const words = clean.split(/[\s._-]+/).filter(Boolean);
        const initials = (words.length > 1 ? words.map(w => w[0]) : clean.replace(/[^a-zA-Z0-9\u00c0-\u024f]/g, '').slice(0, Math.max(1, Math.min(3, capacity)))).join('').toUpperCase();
        return initials.slice(0, capacity);
    },

    _tileStyle(state, size) {
        const radius = size <= 14 ? 0 : Math.min(10, Math.floor(size * 0.10));
        return `padding: 0px; margin: 0px; border-width: 0px; border-radius: ${radius}px; background-color: ${this._color(state)}; background-image: none; box-shadow: none;`;
    },

    _rebuild() {
        if (this._gone) return;
        this._hideTileTooltip();
        this._lastVisualSignature = this._visualSignature();
        let rows = this._normalized();
        const existing = new Set(rows.map(r => r.id));
        for (const id of this._entries.keys()) if (!existing.has(id)) this._entries.delete(id);
        const bg = this.backgroundColor || 'dark';
        const backgrounds = {dark:'#1b1f23', light:'#ebeff4', black:'#000000', transparent:'transparent'};
        // The host actor must be transparent too; Cinnamon's desklet theme otherwise
        // paints an opaque background behind our content.
        const background = backgrounds[bg] || backgrounds.dark;
        const margin = Math.max(0, Math.min(60, Number(this.tileMargin ?? 6)));
        const outer = new St.BoxLayout({vertical: true});
        outer.set_style(`background-color: ${background} !important; background-image: none; border: none; box-shadow: none; border-radius: 0px; padding: ${margin}px;`);
        outer.set_style_class_name('');
        if (this.showTitle === true || this.showTitle === 'true') outer.add_child(new St.Label({text: this._t('Monitor usług', 'Service Monitor'), style: 'color: #ffffff; font-weight: bold; padding-bottom: 4px;'}));
        const gap = Math.max(0, Math.min(60, Number(this.tileGap ?? 3)));
        const grid = new St.BoxLayout({vertical:true, style:`spacing: ${gap}px;`});
        const colCount = Math.max(1, Number(this.columns || 3));
        let line = null;
        rows.forEach((row, i) => {
            if (i % colCount === 0) { line = new St.BoxLayout({style:`spacing: ${gap}px;`}); grid.add_child(line); }
            let state = this._entries.get(row.id);
            if (!state) { state = {status:'unknown', detail:'', last:0, checkedAt:0, busy:false, generation:0}; this._entries.set(row.id, state); }
            // Keep St.Button transparent. Draw color and corners on a dedicated
            // St.Bin child so button theme hover/focus won't impose round corners.
            const tile = new St.Button({ reactive:true, can_focus:true, track_hover:true,
                style: 'padding: 0px; margin: 0px; border-width: 0px; border-radius: 0px; background-color: transparent; background-image: none; box-shadow: none;' });
            const size = Math.max(10, Math.min(180, Number(this.tileSize || 80)));
            tile.set_size(size, size);
            // Plain St.Widget is not a Cinnamon button: no theme radius/hover effect.
            const surface = new Clutter.Actor({reactive:false, width:size, height:size});
            const rgba = this._color(state.status);
            surface.set_background_color(Clutter.Color.from_string(rgba)[1]);
            // Clutter.Actor paints a real square; no Cinnamon CSS border-radius.

            if (size >= 22) {
                const label = new St.Label({text: this._tileText(row.name, size), style:`color: white; font-weight: bold; font-size: ${Math.max(7, Math.min(11, Math.floor(size * 0.22)))}px;`});
                // Center using the actual text dimensions, not fixed offsets.
                // Also clip/ellipsize very small tiles so text cannot overflow.
                label.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
                label.clutter_text.set_line_alignment(Pango.Alignment.CENTER);
                surface.add_child(label);
                const naturalWidth = label.get_preferred_width(-1)[1];
                const naturalHeight = label.get_preferred_height(-1)[1];
                const textWidth = Math.min(size, Math.ceil(naturalWidth));
                const textHeight = Math.min(size, Math.ceil(naturalHeight));
                label.set_size(textWidth, textHeight);
                label.set_position(Math.floor((size - textWidth) / 2), Math.floor((size - textHeight) / 2));
            }
            tile.set_child(surface);
            tile.connect('enter-event', () => this._showTileTooltip(tile, row));
            state.tile = tile;
            state.row = row;
            tile.connect('leave-event', () => this._hideTileTooltip());
            tile.connect('clicked', () => { this._refreshEntry(state); this._tick(); });
            line.add_child(tile);
            state.actor = surface;
        });
        outer.add_child(grid);
        if (!rows.length) {
            outer.add_child(new St.Label({text: this._t('Kliknij prawym przyciskiem, aby dodać usługę.', 'Right-click to add a service.'), style:'color: #dddddd; font-size: 11px;'}));
        }
        this.setContent(outer);
        if (this.actor) {
            this.actor.set_style('background-color: transparent !important; background-image: none; border: 0; box-shadow: none; padding: 0;');
        }
        if (this._container) this._container.set_style('background-color: transparent; background-image: none; border-width: 0px; border-radius: 0px; box-shadow: none; padding: 0px;');
        this._applyDecorations();
        global.log('Mint Service Tiles 0.19: redraw bg=' + bg + ' margin=' + margin + ' gap=' + gap + ' showTitle=' + this.showTitle + ' language=' + this.language);
        this._tick();
    },

    _showAddDialog() {
        if (this._gone) return;
        const dialog = new ModalDialog.ModalDialog();
        const form = new St.BoxLayout({vertical: true, style: 'spacing: 8px; min-width: 340px;'});
        const fields = {};
        const addField = (key, label, initial) => {
            form.add_child(new St.Label({text: label}));
            const entry = new St.Entry({text: initial, can_focus: true, style: 'padding: 7px;'});
            form.add_child(entry);
            fields[key] = entry;
        };
        form.add_child(new St.Label({text: this._t('Dodaj monitorowany adres', 'Add monitored service'), style: 'font-weight: bold; font-size: 17px;'}));
        addField('name', this._t('Nazwa', 'Name'), '');
        addField('target', 'URL / IP', '');
        let mode = 'http';
        form.add_child(new St.Label({text: this._t('Tryb sprawdzania', 'Check mode')}));
        const modeRow = new St.BoxLayout();
        const http = new St.Button({label: 'HTTP', style: 'padding: 8px; background: #166534;'});
        const ping = new St.Button({label: 'PING', style: 'padding: 8px; margin-left: 8px;'});
        const updateMode = () => {
            http.set_style('padding: 8px; background: ' + (mode === 'http' ? '#166534;' : '#555555;'));
            ping.set_style('padding: 8px; margin-left: 8px; background: ' + (mode === 'ping' ? '#166534;' : '#555555;'));
        };
        http.connect('clicked', () => { mode = 'http'; updateMode(); });
        ping.connect('clicked', () => { mode = 'ping'; updateMode(); });
        updateMode();
        modeRow.add_child(http);
        modeRow.add_child(ping);
        form.add_child(modeRow);
        addField('interval', this._t('Interwał w sekundach (minimum 5)', 'Interval in seconds (min 5)'), '30');
        const error = new St.Label({text: '', style: 'color: #ff7777;'});
        form.add_child(error);
        dialog.contentLayout.add_child(form);
        dialog.addButton({label: this._t('Anuluj', 'Cancel'), action: () => dialog.close(), key: Clutter.KEY_Escape});
        dialog.addButton({label: this._t('Dodaj', 'Add'), action: () => {
            const name = fields.name.get_text().trim();
            const target = fields.target.get_text().trim();
            const interval = Number(fields.interval.get_text().trim());
            if (!target || !Number.isInteger(interval) || interval < 5 || interval > 86400) {
                error.set_text(this._t('Podaj adres i interwał od 5 do 86400 sekund.', 'Enter an address and interval between 5 and 86400 seconds.'));
                return;
            }
            if (mode === 'http') {
                const value = target.includes('://') ? target : 'http://' + target;
                if (!/^https?:\/\/[^\s/]+/i.test(value)) {
                    error.set_text(this._t('Niepoprawny adres HTTP/HTTPS.', 'Invalid HTTP/HTTPS address.'));
                    return;
                }
            }
            const list = Array.isArray(this.services) ? this.services.slice() : [];
            list.push({name: name || target, target, mode, interval});
            try {
                this._settings.setValue('services', list);
                this.services = list;
                this._rebuild();
                dialog.close();
            } catch (e) {
                error.set_text(this._t('Nie udało się zapisać: ', 'Could not save: ') + e.message);
                global.logError(e);
            }
        }, key: Clutter.KEY_Return});
        dialog.open();
        dialog.setInitialKeyFocus(fields.name);
    },


    _hideTileTooltip() {
        if (this._activeTooltip) {
            this._activeTooltip.destroy();
            this._activeTooltip = null;
        }
    },

    _showTileTooltip(tile, row) {
        this._hideTileTooltip();
        const screenWidth = global.stage.width;
        const screenHeight = global.stage.height;
        const width = Math.min(340, Math.max(120, screenWidth - 24));
        const state = this._entries.get(row.id);
        let statusText = this._t('Jeszcze nie sprawdzono', 'Not checked yet');
        if (state && state.status === 'ok') statusText = this._t('OK', 'OK');
        else if (state && state.status === 'fail') statusText = this._t('BŁĄD', 'FAILED');
        const detail = state && state.detail ? ' — ' + state.detail : '';
        const lastTime = state && state.checkedAt
            ? new Date(state.checkedAt).toLocaleString() : this._t('brak', 'none');
        const label = new St.Label({text: `${row.name}\n${row.mode.toUpperCase()}: ${row.target}\n${this._t('Ostatni wynik', 'Last result')}: ${statusText}${detail}\n${this._t('Ostatnie sprawdzenie', 'Last check')}: ${lastTime}`,
            style: 'font-size: 12px; color: #ffffff; padding: 8px; background-color: rgba(22,27,34,0.97); border: 1px solid #88929f; border-radius: 5px;'});
        label.clutter_text.set_line_wrap(true);
        label.clutter_text.set_line_wrap_mode(Pango.WrapMode.CHAR);
        label.clutter_text.set_ellipsize(Pango.EllipsizeMode.NONE);
        label.set_width(width);
        global.stage.add_child(label);
        const [, height] = label.get_preferred_height(width);
        const [x, y] = tile.get_transformed_position();
        // Prefer left side of hovered tile near the right edge; clamp to all stage edges.
        let tx = x + tile.width + 8;
        if (tx + width > screenWidth - 8) tx = x - width - 8;
        tx = Math.max(8, Math.min(tx, screenWidth - width - 8));
        let ty = y;
        ty = Math.max(8, Math.min(ty, Math.max(8, screenHeight - height - 8)));
        label.set_position(Math.round(tx), Math.round(ty));
        this._activeTooltip = label;
    },

    _refreshHoveredTooltip(entry) {
        if (entry.tile && entry.tile.hover && entry.row) this._showTileTooltip(entry.tile, entry.row);
    },

    _color(state) { return state === 'ok' ? '#198754' : state === 'fail' ? '#bb3434' : '#687078'; },

    _tick() {
        if (this._gone) return;
        // Settings binding notifications are not reliable with every Cinnamon version.
        // Read the in-memory Settings API; never read the JSON config file here.
        this._readSettings();
        if (this._visualSignature() !== this._lastVisualSignature) {
            this._queueRebuild();
            return;
        }
        const now = Date.now();
        for (const row of this._normalized()) {
            const entry = this._entries.get(row.id);
            if (!entry || entry.busy || (now - entry.last < row.interval * 1000)) continue;
            entry.last = now;
            entry.busy = true;
            const generation = ++entry.generation;
            try {
                const proc = Gio.Subprocess.new([BINARY, '--check', row.id, row.mode, row.target, '5000'],
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
                proc.communicate_utf8_async(null, null, (p, res) => {
                    let result;
                    try {
                        const [, stdout] = p.communicate_utf8_finish(res);
                        result = JSON.parse(stdout);
                    } catch (e) { result = {ok:false, detail:String(e)}; }
                    if (this._gone || this._entries.get(row.id) !== entry || generation !== entry.generation) return;
                    entry.busy = false;
                    entry.status = result.ok ? 'ok' : 'fail';
                    entry.detail = result.detail || '';
                    entry.checkedAt = Date.now();
                    this._refreshHoveredTooltip(entry);
                    if (entry.actor) entry.actor.set_background_color(Clutter.Color.from_string(this._color(entry.status))[1]);
                    this._syncAlarm();
                    if (entry.refreshPending) { entry.refreshPending = false; entry.last = 0; this._tick(); }
                });
            } catch (e) {
                entry.busy = false;
                entry.status = 'fail';
                entry.detail = String(e);
                entry.checkedAt = Date.now();
                this._refreshHoveredTooltip(entry);
                if (entry.actor) entry.actor.set_background_color(Clutter.Color.from_string(this._color(entry.status))[1]);
                this._syncAlarm();
            }
        }
    },

    _syncAlarm() {
        const broken = this._normalized().filter(row => this._entries.get(row.id)?.status === 'fail');
        if (broken.length && this.alarmWindow) {
            if (!this._alarm) {
                try { this._alarm = Gio.Subprocess.new([BINARY, '--alarm'], Gio.SubprocessFlags.NONE); }
                catch (e) { global.logError(e); }
            }
        } else if (this._alarm) {
            this._alarm.force_exit(); this._alarm = null;
        }
    },

    _refreshEntry(state) {
        if (state.busy) state.refreshPending = true;
        else state.last = 0;
    },

    checkNow() {
        for (const state of this._entries.values()) this._refreshEntry(state);
        this._tick();
    },

    on_desklet_removed() {
        this._gone = true;
        this._hideTileTooltip();
        if (this._tickId) { Mainloop.source_remove(this._tickId); this._tickId = 0; }
        if (this._alarm) { this._alarm.force_exit(); this._alarm = null; }
        this._settings.finalize();
    }
};

function main(metadata, deskletId) { return new ServiceTiles(metadata, deskletId); }
