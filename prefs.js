/* prefs.js
 *
 * Pengaturan Hijri Clock.
 * SPDX-License-Identifier: MIT
 */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const CAL_TYPES = [
    {id: 'islamic-umalqura', label: 'Umm al-Qura (Saudi, umum)'},
    {id: 'islamic-civil', label: 'Islamic — Civil (aritmatika)'},
    {id: 'islamic-tbla', label: 'Islamic — Tabular (astronomis)'},
];

/**
 * Muat daftar kode wilayah (Kepmendagri) dari data/wilayah.csv.gz.
 * @param {string} path - path berkas gzip
 * @returns {{names: Map<string,string>, children: Map<string,string[]>}}
 */
function loadWilayah(path) {
    const [, compressed] = Gio.File.new_for_path(path).load_contents(null);
    const decompressor = new Gio.ZlibDecompressor({
        format: Gio.ZlibCompressorFormat.GZIP,
    });
    const memIn = Gio.MemoryInputStream.new_from_bytes(new GLib.Bytes(compressed));
    const stream = Gio.DataInputStream.new(
        Gio.ConverterInputStream.new(memIn, decompressor));

    const names = new Map();
    const children = new Map();
    let line;
    while ((line = stream.read_line_utf8(null)[0]) !== null) {
        const i = line.indexOf(',');
        if (i < 0)
            continue;
        const code = line.slice(0, i);
        names.set(code, line.slice(i + 1));
        const j = code.lastIndexOf('.');
        const parent = j < 0 ? '' : code.slice(0, j);
        if (!children.has(parent))
            children.set(parent, []);
        children.get(parent).push(code);
    }
    stream.close(null);
    for (const arr of children.values())
        arr.sort((a, b) => names.get(a).localeCompare(names.get(b), 'id'));
    return {names, children};
}

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

        this._buildWeatherPage(window, settings);
    }

    _buildWeatherPage(window, settings) {
        const page = new Adw.PreferencesPage({
            title: 'Cuaca',
            icon_name: 'weather-few-clouds-symbolic',
        });
        window.add(page);

        // --- Opsi cuaca ---
        const opts = new Adw.PreferencesGroup({title: 'Cuaca BMKG'});
        page.add(opts);

        const showWeather = new Adw.SwitchRow({
            title: 'Tampilkan cuaca BMKG',
            subtitle: 'Prakiraan sampai level desa/kelurahan di dropdown',
        });
        settings.bind('show-weather', showWeather, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        opts.add(showWeather);

        const hideNative = new Adw.SwitchRow({
            title: 'Sembunyikan cuaca bawaan',
            subtitle: 'Sembunyikan widget cuaca GNOME (GWeather)',
        });
        settings.bind('hide-native-weather', hideNative, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        opts.add(hideNative);

        const refresh = new Adw.SpinRow({
            title: 'Interval penyegaran',
            subtitle: 'Menit antar pembaruan data cuaca',
            adjustment: new Gtk.Adjustment({
                lower: 10,
                upper: 360,
                step_increment: 10,
                page_increment: 30,
                value: settings.get_int('weather-refresh-mins'),
            }),
        });
        settings.bind('weather-refresh-mins', refresh, 'value',
            Gio.SettingsBindFlags.DEFAULT);
        opts.add(refresh);

        // --- Pemilih lokasi ---
        const locGroup = new Adw.PreferencesGroup({
            title: 'Lokasi',
            description: 'Pilih Provinsi → Kabupaten/Kota → Kecamatan → Desa/Kelurahan.',
        });
        page.add(locGroup);

        let data;
        try {
            data = loadWilayah(`${this.path}/data/wilayah.csv.gz`);
        } catch (e) {
            // Fallback: entri manual kode adm4 bila data gagal dimuat.
            const row = new Adw.EntryRow({title: 'Kode wilayah (adm4)'});
            row.text = settings.get_string('adm4');
            row.connect('changed', () => settings.set_string('adm4', row.text.trim()));
            locGroup.add(row);
            const info = new Adw.ActionRow({
                title: 'Daftar kode gagal dimuat',
                subtitle: `${e.message} — masukkan kode adm4 manual (mis. 33.73.02.1005)`,
            });
            locGroup.add(info);
            return;
        }

        const {names, children} = data;

        const provRow = new Adw.ComboRow({title: 'Provinsi'});
        const kabRow = new Adw.ComboRow({title: 'Kabupaten/Kota'});
        const kecRow = new Adw.ComboRow({title: 'Kecamatan'});
        const desRow = new Adw.ComboRow({title: 'Desa/Kelurahan'});
        [provRow, kabRow, kecRow, desRow].forEach(r => locGroup.add(r));

        const selected = new Adw.ActionRow({title: 'Terpilih'});
        selected.add_css_class('property');
        locGroup.add(selected);

        let loading = false;

        const fill = (row, codes) => {
            const model = new Gtk.StringList();
            codes.forEach(c => model.append(names.get(c)));
            row._codes = codes;
            row.model = model;
            row.selected = codes.length ? 0 : Gtk.INVALID_LIST_POSITION;
        };

        const selectCode = (row, code) => {
            const idx = row._codes.indexOf(code);
            if (idx >= 0)
                row.selected = idx;
        };

        const commit = () => {
            const code = desRow._codes[desRow.selected];
            if (!code)
                return;
            settings.set_string('adm4', code);
            settings.set_string('location-name', names.get(code) ?? '');
            const parts = [
                names.get(code),
                names.get(code.slice(0, 8)),
                names.get(code.slice(0, 5)),
            ].filter(Boolean);
            selected.subtitle = `${parts.join(', ')}  ·  ${code}`;
        };

        provRow.connect('notify::selected', () => {
            if (loading)
                return;
            const p = provRow._codes[provRow.selected];
            if (p === undefined)
                return;
            loading = true;
            fill(kabRow, children.get(p) ?? []);
            fill(kecRow, children.get(kabRow._codes[0] ?? '') ?? []);
            fill(desRow, children.get(kecRow._codes[0] ?? '') ?? []);
            loading = false;
            commit();
        });
        kabRow.connect('notify::selected', () => {
            if (loading)
                return;
            const k = kabRow._codes[kabRow.selected];
            if (k === undefined)
                return;
            loading = true;
            fill(kecRow, children.get(k) ?? []);
            fill(desRow, children.get(kecRow._codes[0] ?? '') ?? []);
            loading = false;
            commit();
        });
        kecRow.connect('notify::selected', () => {
            if (loading)
                return;
            const kc = kecRow._codes[kecRow.selected];
            if (kc === undefined)
                return;
            loading = true;
            fill(desRow, children.get(kc) ?? []);
            loading = false;
            commit();
        });
        desRow.connect('notify::selected', () => {
            if (!loading)
                commit();
        });

        // Isi awal + preselect dari pengaturan.
        loading = true;
        fill(provRow, children.get('') ?? []);
        const cur = settings.get_string('adm4');
        if (cur && names.has(cur)) {
            const prov = cur.slice(0, 2);
            const kab = cur.slice(0, 5);
            const kec = cur.slice(0, 8);
            selectCode(provRow, prov);
            fill(kabRow, children.get(prov) ?? []);
            selectCode(kabRow, kab);
            fill(kecRow, children.get(kab) ?? []);
            selectCode(kecRow, kec);
            fill(desRow, children.get(kec) ?? []);
            selectCode(desRow, cur);
            selected.subtitle = `${names.get(cur)}  ·  ${cur}`;
        } else {
            fill(kabRow, children.get(provRow._codes[0]) ?? []);
            fill(kecRow, children.get(kabRow._codes[0] ?? '') ?? []);
            fill(desRow, children.get(kecRow._codes[0] ?? '') ?? []);
            selected.subtitle = 'Belum dipilih';
        }
        loading = false;
    }
}
