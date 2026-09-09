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

### Cuaca BMKG

- Prakiraan cuaca **BMKG** langsung di dropdown kalender, menggantikan widget
  cuaca bawaan GNOME (GWeather) yang hanya sampai level kota.
- **Sampai level desa/kelurahan** (kode wilayah adm4) — mis. Tingkir Lor,
  Kota Salatiga, bukan sekadar "Semarang".
- Pemilih lokasi **bertingkat** di pengaturan: Provinsi → Kabupaten/Kota →
  Kecamatan → Desa/Kelurahan (91.599 wilayah, offline).
- Ikon simbolik mengikuti tema, prakiraan 3-jaman, penyegaran berkala.

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
| Tampilkan cuaca BMKG | aktif | Section cuaca di dropdown |
| Sembunyikan cuaca bawaan | aktif | Sembunyikan widget GWeather |
| Lokasi cuaca | — | Pilih bertingkat sampai desa/kelurahan |
| Interval penyegaran | 60 mnt | 10–360 menit |

## Catatan penanggalan

Tanggal Hijriah dihitung memakai API `Intl.DateTimeFormat` bawaan sistem
(ICU). Metode **Umm al-Qura** adalah standar yang paling umum, namun awal
bulan hasil hisab bisa berbeda 1 hari dari penetapan pemerintah/rukyat
setempat — gunakan opsi **Koreksi hari** bila perlu.

## Sumber data & atribusi

- Cuaca: **API publik BMKG** — <https://data.bmkg.go.id/prakiraan-cuaca/>
  (`https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=<kode>`).
- Kode wilayah: dataset **Kepmendagri No. 100.1.1-6117 Tahun 2022** via
  [cahyadsn/wilayah](https://github.com/cahyadsn/wilayah), dikemas ulang jadi
  `data/wilayah.csv.gz`.

## Lisensi

[MIT](LICENSE) — kode extension. Data wilayah & cuaca mengikuti sumber
masing-masing di atas.
