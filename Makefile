UUID = hijri-clock@ihfazh.com
INSTALL_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
FILES = extension.js prefs.js metadata.json stylesheet.css schemas

.PHONY: all schemas install enable disable uninstall zip

all: schemas

# Kompilasi GSettings schema.
schemas:
	glib-compile-schemas schemas

# Pasang ke direktori extension pengguna.
install: schemas
	rm -rf "$(INSTALL_DIR)"
	mkdir -p "$(INSTALL_DIR)"
	cp -r $(FILES) "$(INSTALL_DIR)/"
	@echo "Terpasang di $(INSTALL_DIR)"
	@echo "Wayland: logout/login dulu, lalu: make enable"

enable:
	gnome-extensions enable $(UUID)

disable:
	gnome-extensions disable $(UUID)

uninstall:
	rm -rf "$(INSTALL_DIR)"

# Paket untuk unggah ke extensions.gnome.org.
zip: schemas
	rm -f $(UUID).zip
	zip -r $(UUID).zip $(FILES) LICENSE README.md
	@echo "Dibuat: $(UUID).zip"
