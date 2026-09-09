/* prefs.js
 *
 * Pengaturan Hijri Clock.
 * SPDX-License-Identifier: MIT
 */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const CAL_TYPES = [
    {id: 'islamic-umalqura', label: 'Umm al-Qura (Saudi, umum)'},
    {id: 'islamic-civil', label: 'Islamic — Civil (aritmatika)'},
    {id: 'islamic-tbla', label: 'Islamic — Tabular (astronomis)'},
];

export default class HijriClockPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'Umum',
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);

        // --- Tampilan ---
        const display = new Adw.PreferencesGroup({title: 'Tampilan'});
        page.add(display);

        const showPanel = new Adw.SwitchRow({
            title: 'Tampilkan di panel',
            subtitle: 'Tanggal Hijriah di sebelah jam di top bar',
        });
        settings.bind('show-panel', showPanel, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        display.add(showPanel);

        const showNumbers = new Adw.SwitchRow({
            title: 'Angka Hijriah di kalender',
            subtitle: 'Angka kecil Hijriah pada tiap tanggal di dropdown',
        });
        settings.bind('show-calendar-numbers', showNumbers, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        display.add(showNumbers);

        // --- Penanggalan ---
        const calGroup = new Adw.PreferencesGroup({
            title: 'Penanggalan',
            description: 'Sesuaikan metode dan koreksi hari bila perlu.',
        });
        page.add(calGroup);

        const model = new Gtk.StringList();
        CAL_TYPES.forEach(c => model.append(c.label));
        const calRow = new Adw.ComboRow({
            title: 'Metode kalender',
            model,
        });
        const curId = settings.get_string('calendar-type');
        calRow.selected = Math.max(0, CAL_TYPES.findIndex(c => c.id === curId));
        calRow.connect('notify::selected', () => {
            settings.set_string('calendar-type', CAL_TYPES[calRow.selected].id);
        });
        calGroup.add(calRow);

        const offset = new Adw.SpinRow({
            title: 'Koreksi hari',
            subtitle: 'Geser tanggal Hijriah (mis. −1 atau +1) sesuai rukyat lokal',
            adjustment: new Gtk.Adjustment({
                lower: -3,
                upper: 3,
                step_increment: 1,
                page_increment: 1,
                value: settings.get_int('day-offset'),
            }),
        });
        settings.bind('day-offset', offset, 'value',
            Gio.SettingsBindFlags.DEFAULT);
        calGroup.add(offset);
    }
}
