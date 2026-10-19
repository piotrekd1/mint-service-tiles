# Mint Service Tiles

A lightweight **Cinnamon desklet for Linux Mint** that monitors HTTP(S) endpoints and hosts with ICMP ping, showing their status as compact colored tiles on your desktop.

**Version:** 0.20  
**Author:** piotrek-d1 (piotrek-d1@o2.pl)

## Features

- **Green / red / gray tiles:** available / unavailable / not yet checked.
- Two monitoring modes per service:
  - **HTTP/HTTPS:** healthy only when the response status is **200**.
  - **ICMP ping:** healthy when the host answers a ping request (no HTTP status involved).
- Independently configurable check interval for every address.
- Hover details show the target address, last check result and last check time.
- Separate log file for each monitored service.
- Optional alarm window when a service is down; behavior depends on the desktop/window manager.
- Adjustable tile size, grid columns, outer margins, spacing between tiles (default **3 px**), background and title visibility.
- Tile names are centered; very small tiles hide their label.
- Uses Cinnamon's native desklet configuration window.
- Automatically selects a bundled translation matching the system locale, with English as fallback. Includes **22 languages**.

The UI is implemented as a native **Cinnamon JavaScript/GJS desklet**; service checks and the alert window are implemented by a **C++ / Qt 6** helper.

## Requirements

- Linux Mint with the **Cinnamon** desktop environment
- C++17 compiler, CMake 3.16 or newer
- Qt 6 development packages (Core, Network and Widgets)
- `ping` from `iputils-ping`
- Python 3 (for translation synchronization)

Install development dependencies on a typical Linux Mint system:

```bash
sudo apt update
sudo apt install build-essential cmake qt6-base-dev iputils-ping python3
```

## Installation

Clone the repository (or download and extract its ZIP archive):

```bash
git clone https://github.com/YOUR-USERNAME/mint-service-tiles.git
cd mint-service-tiles
./install.sh
```

Replace `YOUR-USERNAME` with the GitHub account that hosts the project. If needed, run `chmod +x install.sh` first.

Then open **Desktop → Desklets → Manage**, find **Service Tiles**, and add it to the desktop. Log out and back in if Cinnamon is still using an earlier version.

The installer compiles `mint-service-check`, installs the desklet under `~/.local/share/cinnamon/desklets/service-tiles@local/`, and installs a language synchronization helper under `~/.local/bin/`.

## Configuration

Right-click the desklet and select Cinnamon's **Configure** item. Add monitored endpoints to the services table. For each entry, set a name, target, mode (`http` or `ping`) and interval in seconds.

Examples:

| Name | Target | Mode | Interval |
| --- | --- | --- | ---: |
| Website | `https://example.com/health` | `http` | 30 s |
| Router | `192.168.1.1` | `ping` | 10 s |

> HTTP mode checks for exactly **200 OK**. Other status codes (including redirects) are reported as unavailable. Ping mode checks ICMP reachability, not TCP/HTTP application health.

Use **Check now** in the configuration window to request an immediate check.

## Languages

Language files live in `desklet/service-tiles@local/locale/`:

`en`, `pl`, `de`, `fr`, `es`, `it`, `pt`, `nl`, `cs`, `sk`, `uk`, `ru`, `sv`, `nb`, `da`, `fi`, `hu`, `ro`, `bg`, `el`, `tr`, `ja`.

When the system language changes, log out and back in. To synchronize the translated labels in Cinnamon's native configuration window manually, close the configuration window and run:

```bash
~/.local/bin/mint-service-tiles-sync-language
```

Unsupported locales use English. Translations are community-review candidates; improvements are welcome.

## Data and logs

Cinnamon stores desklet settings under:

```text
~/.config/cinnamon/spices/service-tiles@local/
```

The C++ helper stores logs in its Qt application-data directory, under a `logs/` subdirectory. This location depends on the user's XDG configuration and Qt application name.

**Privacy:** monitoring requests and log entries can include configured hostnames and URLs. Avoid committing personal configuration files, logs, secrets or internal network addresses to public repositories.

## Project layout

```text
.
├── desklet/service-tiles@local/
│   ├── desklet.js
│   ├── icon.png
│   ├── metadata.json
│   ├── settings-schema.json
│   └── locale/                 # 22 JSON translations
├── src/main.cpp               # C++ / Qt monitoring helper
├── CMakeLists.txt
├── install.sh
└── refresh-translations.py    # Update localized Cinnamon setting labels
```

## Development and troubleshooting

Build the helper directly:

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j"$(nproc)"
```

Check the installed desklet version:

```bash
grep version ~/.local/share/cinnamon/desklets/service-tiles@local/metadata.json
```

Cinnamon's JavaScript errors can be inspected through **Looking Glass** (`Alt+F2`, enter `lg`, then look for the errors tab). A live Cinnamon session is required for full UI testing.

## License

Copyright (C) 2026 piotrek-d1 <piotrek-d1@o2.pl>.

Mint Service Tiles is licensed under the **GNU General Public License, version 3 or (at your option) any later version** (`GPL-3.0-or-later`). See [LICENSE](LICENSE) for the full license text.

This program is distributed **without any warranty**, to the extent permitted by law. External dependencies (including Qt, Cinnamon, Python and system utilities) retain their respective licenses.

