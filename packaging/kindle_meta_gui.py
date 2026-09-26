"""Launcher für PyInstaller: startet die kindle-meta-GUI."""

from __future__ import annotations

import sys

from kindle_meta.gui.app import main

if __name__ == "__main__":
    sys.exit(main())
