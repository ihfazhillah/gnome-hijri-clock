# Hijri Clock

Extension GNOME Shell yang menampilkan **tanggal Hijriah berdampingan dengan jam Masehi** di panel atas, dan menambahkan **angka Hijriah pada tiap tanggal** di kalender dropdown.

![screenshot](screenshot.png)

## Fitur

- Tanggal Hijriah ringkas di top bar, menempel jam Masehi bawaan GNOME
  (contoh: `27 Rabiulawal · Sep 9  8:06 AM`).
- Header tanggal Hijriah lengkap di dalam dropdown kalender
  (contoh: `27 Rabiulawal 1448 H`).
- Angka Hijriah kecil pada setiap sel tanggal kalender — warna mengikuti tema.
- Nama bulan Bahasa Indonesia (via kalender `islamic-umalqura` bawaan sistem).
- Pengaturan: pilih metode kalender (Umm al-Qura / civil / tabular),
  koreksi ±hari untuk menyesuaikan rukyat lokal, dan tampilkan/sembunyikan
  masing-masing elemen.

Non-destruktif: extension hanya menempel pada menu tanggal bawaan GNOME dan
mengembalikannya sepenuhnya saat dinonaktifkan.

## Kompatibilitas

GNOME Shell **50** (X11 & Wayland).

## Pemasangan

### Dari sumber

```bash
git clone https://github.com/ihfazhillah/gnome-hijri-clock.git
cd gnome-hijri-clock
make install
```

Lalu **logout/login** (wajib di Wayland karena GNOME Shell tidak bisa
di-restart tanpa keluar sesi), dan aktifkan:

```bash
make enable
# atau via aplikasi "Extensions" / gnome-extensions enable hijri-clock@ihfazh.com
```

Buka pengaturan:

```bash
gnome-extensions prefs hijri-clock@ihfazh.com
```

### Menonaktifkan / menghapus

```bash
make disable
make uninstall
```

## Pengaturan

| Opsi | Default | Keterangan |
|------|---------|------------|
| Tampilkan di panel | aktif | Tanggal Hijriah di sebelah jam |
| Angka Hijriah di kalender | aktif | Angka kecil pada tiap tanggal |
| Metode kalender | Umm al-Qura | `islamic-umalqura` / `islamic-civil` / `islamic-tbla` |
| Koreksi hari | 0 | Geser −3…+3 hari sesuai rukyat lokal |

## Catatan penanggalan

Tanggal Hijriah dihitung memakai API `Intl.DateTimeFormat` bawaan sistem
(ICU). Metode **Umm al-Qura** adalah standar yang paling umum, namun awal
bulan hasil hisab bisa berbeda 1 hari dari penetapan pemerintah/rukyat
setempat — gunakan opsi **Koreksi hari** bila perlu.

## Lisensi

[MIT](LICENSE)
