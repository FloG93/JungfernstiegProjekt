# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller-Spec: Ein-Datei-GUI-App für kindle-meta."""

a = Analysis(
    ["kindle_meta_gui.py"],
    pathex=[".."],
    binaries=[],
    datas=[],
    hiddenimports=[
        "ebooklib",
        "ebooklib.epub",
        "pypdf",
        "PIL",
        "PIL.Image",
        "requests",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter"],
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="kindle-meta",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
