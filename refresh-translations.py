#!/usr/bin/env python3
# Copyright (C) 2026 piotrek-d1 <piotrek-d1@o2.pl>
# SPDX-License-Identifier: GPL-3.0-or-later
"""Synchronize Cinnamon's cached labels to the login-session language.

Never change any setting value or services list. Close Cinnamon's settings
window before running manually, to avoid racing its writes.
"""
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile

ROOT = Path(__file__).resolve().parent
UUID = 'service-tiles@local'
DEST = Path.home() / '.local/share/cinnamon/desklets' / UUID
CACHE = Path.home() / '.config/cinnamon/spices' / UUID


def language():
    # GNU gettext uses LANGUAGE as the preferred UI language unless LC_ALL overrides.
    name = os.environ.get('LC_ALL') or os.environ.get('LANGUAGE') or os.environ.get('LC_MESSAGES') or os.environ.get('LANG') or 'en'
    primary = name.split(':', 1)[0].split('_', 1)[0].split('.', 1)[0].split('@', 1)[0].lower()
    if primary in ('no', 'nn'):
        primary = 'nb'
    return primary if (DEST / 'locale' / (primary + '.json')).is_file() else 'en'


def atomic_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=str(path.parent), prefix='.locale-', suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as out:
            json.dump(data, out, ensure_ascii=False, indent=2)
            out.write('\n')
        if path.exists():
            os.chmod(name, path.stat().st_mode & 0o777)
        else:
            os.chmod(name, 0o644)
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def apply():
    lang = language()
    source = DEST / 'locale' / (lang + '.json')
    if not source.is_file():
        raise RuntimeError(f'Missing locale file: {source}. Install desklet first.')
    schema = json.loads(source.read_text(encoding='utf-8'))['schema']
    schema_file = DEST / 'settings-schema.json'
    if not schema_file.exists() or json.loads(schema_file.read_text(encoding='utf-8')) != schema:
        atomic_json(schema_file, schema)

    count = 0
    if CACHE.is_dir():
        for cfg in CACHE.glob('*.json'):
            if not cfg.is_file():
                continue
            old = json.loads(cfg.read_text(encoding='utf-8'))
            changed = False
            for key, template in schema.items():
                if not isinstance(old.get(key), dict):
                    continue
                entry = old[key]
                for field in ('description', 'tooltip', 'title', 'units', 'options'):
                    if field in template and entry.get(field) != template[field]:
                        entry[field] = template[field]
                        changed = True
                if key == 'services' and 'columns' in template and entry.get('columns') != template['columns']:
                    entry['columns'] = template['columns']
                    changed = True
            if changed:
                backup = cfg.with_name(cfg.name + '.before-v0.17.bak')
                if not backup.exists():
                    shutil.copy2(cfg, backup)
                atomic_json(cfg, old)
                count += 1
    print(f'Mint Service Tiles: language={lang}; updated setting files={count}')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(apply())
    except (OSError, ValueError, KeyError, RuntimeError) as error:
        print(f'Mint Service Tiles language sync error: {error}', file=sys.stderr)
        sys.exit(1)
