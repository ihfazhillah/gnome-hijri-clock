/* bmkgWeather.js
 *
 * Section cuaca berbasis API publik BMKG (prakiraan-cuaca), sampai level
 * desa/kelurahan (adm4). Meniru tata letak WeatherSection bawaan GNOME
 * dengan ikon simbolik yang mengikuti tema.
 *
 * SPDX-License-Identifier: MIT
 */

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';
import Soup from 'gi://Soup';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const API = 'https://api.bmkg.go.id/publik/prakiraan-cuaca';
const MAX_COLS = 6;

/** Petakan deskripsi cuaca BMKG ke nama ikon simbolik GNOME. */
function symbolicIcon(desc, isNight) {
    const d = (desc || '').toLowerCase();
    if (d.includes('petir'))
        return 'weather-storm-symbolic';
    if (d.includes('hujan')) {
        if (d.includes('ringan') || d.includes('lokal'))
            return 'weather-showers-scattered-symbolic';
        return 'weather-showers-symbolic';
    }
    if (d.includes('kabut') || d.includes('asap') || d.includes('kabur'))
        return 'weather-fog-symbolic';
    if (d.includes('cerah berawan'))
        return isNight ? 'weather-few-clouds-night-symbolic' : 'weather-few-clouds-symbolic';
    if (d.includes('berawan'))
        return 'weather-overcast-symbolic';
    if (d.includes('cerah'))
        return isNight ? 'weather-clear-night-symbolic' : 'weather-clear-symbolic';
    return 'weather-few-clouds-symbolic';
}

/** "2026-09-09 02:00:00" (UTC) -> Date */
function parseUtc(s) {
    return new Date(`${s.replace(' ', 'T')}Z`);
}

/** "2026-09-09 09:00:00" (lokal) -> "09.00" */
function localHourLabel(s) {
    const t = s.split(' ')[1] ?? '';
    return t.slice(0, 5).replace(':', '.');
}

export const BmkgWeatherSection = GObject.registerClass(
class BmkgWeatherSection extends St.Button {
    _init(settings, openPrefs) {
        super._init({
            style_class: 'weather-button',
            can_focus: true,
            x_expand: true,
        });

        this._settings = settings;
        this._openPrefs = openPrefs;
        this._session = new Soup.Session({timeout: 15, user_agent: 'gnome-hijri-clock'});
        this._cancellable = null;
        this._timerId = 0;

        const box = new St.BoxLayout({
            style_class: 'weather-box',
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
        });
        this.child = box;

        const titleBox = new St.BoxLayout({style_class: 'weather-header-box'});
        this._titleLabel = new St.Label({
            style_class: 'weather-header',
            x_align: Clutter.ActorAlign.START,
            x_expand: true,
            y_align: Clutter.ActorAlign.END,
        });
        titleBox.add_child(this._titleLabel);
        box.add_child(titleBox);
        this.labelActor = this._titleLabel;

        this._titleLocation = new St.Label({
            style_class: 'weather-header location',
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.END,
        });
        titleBox.add_child(this._titleLocation);

        const layout = new Clutter.GridLayout({orientation: Clutter.Orientation.VERTICAL});
        this._forecastGrid = new St.Widget({
            style_class: 'weather-grid',
            layout_manager: layout,
        });
        layout.hookup_style(this._forecastGrid);
        box.add_child(this._forecastGrid);
    }

    // Ambil data setiap kali menu ditampilkan.
    vfunc_map() {
        this.refresh();
        super.vfunc_map();
    }

    vfunc_clicked() {
        // Klik membuka pengaturan (untuk memilih/ubah lokasi cuaca).
        if (this._openPrefs) {
            Main.panel.statusArea.dateMenu.menu.close();
            this._openPrefs();
        } else {
            this.refresh();
        }
    }

    _setStatus(text) {
        this._forecastGrid.destroy_all_children();
        this._titleLabel.text = 'Cuaca';
        this._titleLocation.text = '';
        const label = new St.Label({style_class: 'weather-header', text});
        label.clutter_text.line_wrap = true;
        this._forecastGrid.layout_manager.attach(label, 0, 0, 1, 1);
    }

    startAutoRefresh() {
        this.stopAutoRefresh();
        const mins = Math.max(10, this._settings.get_int('weather-refresh-mins'));
        this._timerId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, mins * 60, () => {
                this.refresh();
                return GLib.SOURCE_CONTINUE;
            });
    }

    stopAutoRefresh() {
        if (this._timerId) {
            GLib.Source.remove(this._timerId);
            this._timerId = 0;
        }
    }

    refresh() {
        const adm4 = this._settings.get_string('adm4');
        if (!adm4) {
            this._setStatus('Pilih lokasi cuaca di pengaturan.');
            return;
        }

        this._cancellable?.cancel();
        this._cancellable = new Gio.Cancellable();

        const msg = Soup.Message.new('GET', `${API}?adm4=${encodeURIComponent(adm4)}`);
        this._session.send_and_read_async(
            msg, GLib.PRIORITY_DEFAULT, this._cancellable, (session, res) => {
                let bytes;
                try {
                    bytes = session.send_and_read_finish(res);
                } catch (e) {
                    if (!e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        this._setStatus('Cuaca tidak tersedia (jaringan).');
                    return;
                }
                if (msg.get_status() !== Soup.Status.OK) {
                    this._setStatus('Cuaca tidak tersedia.');
                    return;
                }
                try {
                    const text = new TextDecoder().decode(bytes.get_data());
                    this._render(JSON.parse(text));
                } catch (_e) {
                    this._setStatus('Gagal membaca data cuaca.');
                }
            });
    }

    _render(data) {
        const entry = data?.data?.[0];
        if (!entry?.cuaca) {
            this._setStatus('Data cuaca kosong untuk lokasi ini.');
            return;
        }

        // Ratakan seluruh titik prakiraan dan ambil dari "sekarang" ke depan.
        const flat = entry.cuaca.flat();
        const now = Date.now();
        let points = flat.filter(p => parseUtc(p.utc_datetime).getTime() >= now - 90 * 60 * 1000);
        if (points.length === 0)
            points = flat.slice(-MAX_COLS);
        points = points.slice(0, MAX_COLS);

        const loc = entry.lokasi ?? {};
        const cur = points[0];
        this._titleLabel.text = cur
            ? `${cur.weather_desc} ${Math.round(cur.t)}°`
            : 'Cuaca';
        this._titleLocation.text = loc.desa ?? '';

        const grid = this._forecastGrid;
        grid.destroy_all_children();
        const layout = grid.layout_manager;
        const rtl = grid.text_direction === Clutter.TextDirection.RTL;

        let col = 0;
        points.forEach(p => {
            const hour = parseInt((p.local_datetime.split(' ')[1] ?? '00').slice(0, 2), 10);
            const isNight = hour < 6 || hour >= 18;

            const time = new St.Label({
                style_class: 'weather-forecast-time',
                text: localHourLabel(p.local_datetime),
                x_align: Clutter.ActorAlign.CENTER,
            });
            const icon = new St.Icon({
                style_class: 'weather-forecast-icon',
                icon_name: symbolicIcon(p.weather_desc, isNight),
                x_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
            });
            const temp = new St.Label({
                style_class: 'weather-forecast-temp',
                text: `${Math.round(p.t)}°`,
                x_align: Clutter.ActorAlign.CENTER,
            });
            time.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
            temp.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;

            const c = rtl ? MAX_COLS - 1 - col : col;
            layout.attach(time, c, 0, 1, 1);
            layout.attach(icon, c, 1, 1, 1);
            layout.attach(temp, c, 2, 1, 1);
            col++;
        });
    }

    destroy() {
        this.stopAutoRefresh();
        this._cancellable?.cancel();
        this._cancellable = null;
        this._session?.abort();
        this._session = null;
        super.destroy();
    }
});
