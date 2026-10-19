#!/usr/bin/env bash
# Copyright (C) 2026 piotrek-d1 <piotrek-d1@o2.pl>
# SPDX-License-Identifier: GPL-3.0-or-later
set -euo pipefail
cd "$(dirname "$0")"
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j"$(nproc)"
DEST="$HOME/.local/share/cinnamon/desklets/service-tiles@local"
mkdir -p "$HOME/.local/bin" "$DEST/locale" "$HOME/.config/autostart"
install -m 755 build/mint-service-check "$HOME/.local/bin/mint-service-check"
install -m 644 desklet/service-tiles@local/desklet.js "$DEST/desklet.js"
install -m 644 desklet/service-tiles@local/metadata.json "$DEST/metadata.json"
install -m 644 desklet/service-tiles@local/icon.png "$DEST/icon.png"
install -m 644 desklet/service-tiles@local/locale/*.json "$DEST/locale/"
install -m 755 refresh-translations.py "$DEST/locale-sync.py"
cat > "$HOME/.local/bin/mint-service-tiles-sync-language" <<EOF
#!/usr/bin/env bash
exec /usr/bin/python3 "\$HOME/.local/share/cinnamon/desklets/service-tiles@local/locale-sync.py" "\$@"
EOF
chmod 755 "$HOME/.local/bin/mint-service-tiles-sync-language"
cat > "$HOME/.config/autostart/mint-service-tiles-language.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Mint Service Tiles language sync
Comment=Update desklet settings captions to current login language
Exec=$HOME/.local/bin/mint-service-tiles-sync-language
Terminal=false
NoDisplay=true
X-GNOME-Autostart-enabled=true
EOF
# Run once now (not just at the next login); preserve all setting values.
"$HOME/.local/bin/mint-service-tiles-sync-language"
printf 'Installed Mint Service Tiles 0.20.\n'
printf 'For the current desktop session, close the Cinnamon Configuration window and reopen it.\n'
printf 'After changing the system language, log out and back in.\n'
printf 'Manual sync: ~/.local/bin/mint-service-tiles-sync-language\n'
