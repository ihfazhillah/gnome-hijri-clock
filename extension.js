/* extension.js
 *
 * Hijri Clock — menampilkan tanggal Hijriah berdampingan dengan jam Masehi
 * di panel atas GNOME, dan menambahkan angka Hijriah pada kalender dropdown.
 *
 * SPDX-License-Identifier: MIT
 */

import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {BmkgWeatherSection} from './bmkgWeather.js';

// Locale untuk nama bulan (Bahasa Indonesia). Angka tetap latin.
const LOCALE = 'id-ID';

/**
 * Format tanggal Hijriah dari sebuah Date, dengan koreksi offset hari.
 * @param {Date} date - tanggal Masehi acuan
 * @param {number} offset - koreksi hari (mis. -1, 0, +1)
 * @param {string} calType - kalender Intl (mis. 'islamic-umalqura')
 * @param {object} opts - opsi Intl.DateTimeFormat
 * @returns {string}
 */
function formatHijri(date, offset, calType, opts) {
    const d = new Date(date.getTime());
    if (offset)
        d.setDate(d.getDate() + offset);
    return new Intl.DateTimeFormat(`${LOCALE}-u-ca-${calType}`, opts).format(d);
}

export default class HijriClockExtension extends Extension {
    enable() {
        this._settings = this.getSettings();

        const dateMenu = Main.panel.statusArea.dateMenu;
        this._dateMenu = dateMenu;
        this._clockDisplay = dateMenu._clockDisplay;
        this._calendar = dateMenu._calendar;
        this._todayButton = dateMenu._date;
        this._wallClock = dateMenu._clock;

        // 1) Label Hijriah di panel, tepat sebelum jam Masehi bawaan.
        this._panelLabel = new St.Label({
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'hijri-panel-label',
        });
        this._panelLabel.clutter_text.y_align = Clutter.ActorAlign.CENTER;
        const panelBox = this._clockDisplay.get_parent();
        panelBox.insert_child_below(this._panelLabel, this._clockDisplay);

        // 2) Header Hijriah di popup, di bawah tanggal besar & di atas kalender.
        this._popupHeader = new St.Label({style_class: 'hijri-popup-header'});
        const vbox = this._todayButton.get_parent();
        vbox.insert_child_above(this._popupHeader, this._todayButton);

        // 3) Bungkus _rebuildCalendar milik instance untuk menambah angka Hijriah.
        this._origRebuild = this._calendar._rebuildCalendar;
        const self = this;
        this._calendar._rebuildCalendar = function (...args) {
            self._origRebuild.call(this, ...args);
            if (self._settings?.get_boolean('show-calendar-numbers'))
                self._decorateCalendar();
        };

        // Sinkron dengan jam bawaan (update tiap menit / bangun tidur).
        this._clockNotifyId =
            this._wallClock.connect('notify::clock', () => this._updatePanel());

        // Update header saat tanggal terpilih berubah.
        this._selectedDateId = this._calendar.connect(
            'selected-date-changed', (_cal, datetime) => {
                this._updatePopupHeader(new Date(datetime.to_unix() * 1000));
                this._recolorCalendar();
            });

        // Segarkan warna kalender tiap menu dibuka (mengikuti tema terkini).
        this._menuOpenId = dateMenu.menu.connect('open-state-changed',
            (_menu, isOpen) => {
                if (isOpen)
                    this._recolorCalendar();
            });

        // 4) Cuaca BMKG — section sendiri, ditaruh setelah cuaca bawaan.
        this._weatherItem = dateMenu._weatherItem;
        this._bmkgWeather = new BmkgWeatherSection(
            this._settings, () => this.openPreferences());
        const displaysBox = this._weatherItem.get_parent();
        displaysBox.insert_child_above(this._bmkgWeather, this._weatherItem);

        // Jaga agar cuaca bawaan tetap tersembunyi bila dipilih demikian
        // (widget bawaan bisa memunculkan dirinya lagi saat data berubah).
        this._nativeVisibleId = this._weatherItem.connect('notify::visible', () => {
            if (this._settings.get_boolean('hide-native-weather') &&
                this._weatherItem.visible)
                this._weatherItem.visible = false;
        });

        // Terapkan perubahan pengaturan secara langsung.
        this._settingsId =
            this._settings.connect('changed', () => this._applyAll());

        this._applyAll();
    }

    disable() {
        if (this._clockNotifyId) {
            this._wallClock.disconnect(this._clockNotifyId);
            this._clockNotifyId = null;
        }
        if (this._selectedDateId) {
            this._calendar.disconnect(this._selectedDateId);
            this._selectedDateId = null;
        }
        if (this._menuOpenId) {
            this._dateMenu.menu.disconnect(this._menuOpenId);
            this._menuOpenId = null;
        }
        if (this._settingsId) {
            this._settings.disconnect(this._settingsId);
            this._settingsId = null;
        }

        if (this._nativeVisibleId) {
            this._weatherItem.disconnect(this._nativeVisibleId);
            this._nativeVisibleId = null;
        }
        // Kembalikan tampilan cuaca bawaan.
        if (this._weatherItem)
            this._weatherItem.visible = true;

        this._panelLabel?.destroy();
        this._panelLabel = null;
        this._popupHeader?.destroy();
        this._popupHeader = null;
        this._bmkgWeather?.destroy();
        this._bmkgWeather = null;
        this._weatherItem = null;

        // Kembalikan _rebuildCalendar asli lalu gambar ulang kalender bersih.
        if (this._origRebuild && this._calendar) {
            delete this._calendar._rebuildCalendar;
            this._origRebuild = null;
            this._calendar._rebuildCalendar();
        }

        this._settings = null;
        this._dateMenu = null;
        this._clockDisplay = null;
        this._calendar = null;
        this._todayButton = null;
        this._wallClock = null;
    }

    _config() {
        return {
            offset: this._settings.get_int('day-offset'),
            calType: this._settings.get_string('calendar-type'),
        };
    }

    _applyAll() {
        this._updatePanel();
        const sel = this._calendar._selectedDate ?? new Date();
        this._updatePopupHeader(sel);
        // Bangun ulang agar angka Hijriah ikut berubah (atau hilang jika dimatikan).
        this._calendar._rebuildCalendar();

        // Cuaca.
        const showWeather = this._settings.get_boolean('show-weather');
        this._bmkgWeather.visible = showWeather;
        if (this._settings.get_boolean('hide-native-weather'))
            this._weatherItem.visible = false;
        else
            this._weatherItem.visible = true;
        if (showWeather) {
            this._bmkgWeather.refresh();
            this._bmkgWeather.startAutoRefresh();
        } else {
            this._bmkgWeather.stopAutoRefresh();
        }
    }

    _updatePanel() {
        if (!this._panelLabel)
            return;
        if (!this._settings.get_boolean('show-panel')) {
            this._panelLabel.hide();
            return;
        }
        const {offset, calType} = this._config();
        const text = formatHijri(new Date(), offset, calType,
            {day: 'numeric', month: 'long'});
        this._panelLabel.text = `${text} · `;
        this._panelLabel.show();
    }

    _updatePopupHeader(date) {
        if (!this._popupHeader)
            return;
        const {offset, calType} = this._config();
        this._popupHeader.text = formatHijri(date, offset, calType,
            {day: 'numeric', month: 'long', year: 'numeric'});
    }

    _decorateCalendar() {
        const buttons = this._calendar?._buttons;
        if (!buttons)
            return;
        const {offset, calType} = this._config();
        let count = 0;
        for (const btn of buttons) {
            if (!btn?._date || btn._hijriDecorated)
                continue;
            const native = btn.get_child();
            if (!native)
                continue;

            // Ganti label tunggal dengan kolom vertikal: angka Masehi (dari
            // label bawaan) + angka Hijriah kecil. Warna diambil dari theme
            // node sel sehingga selalu cocok dengan tema & status hari.
            const gregText = native.get_text();
            const hd = formatHijri(btn._date, offset, calType, {day: 'numeric'});

            const box = new St.BoxLayout({
                orientation: Clutter.Orientation.VERTICAL,
                x_expand: true,
                y_expand: true,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            });
            const greg = new St.Label({
                text: gregText,
                x_align: Clutter.ActorAlign.CENTER,
            });
            greg.clutter_text.x_align = Clutter.ActorAlign.CENTER;
            const hijri = new St.Label({
                text: hd,
                style_class: 'hijri-day-number',
                x_align: Clutter.ActorAlign.CENTER,
            });
            hijri.clutter_text.x_align = Clutter.ActorAlign.CENTER;
            box.add_child(greg);
            box.add_child(hijri);

            btn.set_child(box); // menggantikan label bawaan
            btn._hijriGreg = greg;
            btn._hijriSub = hijri;
            btn._hijriDecorated = true;
            count++;
        }
        console.log(`[hijri-clock] dekorasi kalender: ${count} sel, total ${buttons.length}`);
        this._recolorCalendar();
    }

    // Salin warna teks dari theme node tiap sel (adaptif tema & status hari).
    _recolorCalendar() {
        const buttons = this._calendar?._buttons;
        if (!buttons)
            return;
        for (const btn of buttons) {
            if (!btn?._hijriGreg)
                continue;
            let c;
            try {
                c = btn.get_theme_node().get_foreground_color();
            } catch (_e) {
                continue;
            }
            const rgb = `${c.red},${c.green},${c.blue}`;
            btn._hijriGreg.set_style(`color: rgb(${rgb});`);
            btn._hijriSub.set_style(`color: rgba(${rgb}, 0.6); font-size: 0.62em;`);
        }
    }
}
