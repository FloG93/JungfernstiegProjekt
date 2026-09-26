from __future__ import annotations

import time

from kindle_meta.watch import SUPPORTED_EXTS, FolderWatcher


def test_supported_exts_contains_expected_formats():
    assert SUPPORTED_EXTS == {"epub", "pdf", "fb2", "cbz", "cbr", "mobi", "azw3", "azw"}


def test_prime_then_scan_detects_new_file(tmp_path):
    (tmp_path / "alt.epub").write_bytes(b"x")
    watcher = FolderWatcher(str(tmp_path))
    watcher.prime()
    assert watcher.scan() == []

    (tmp_path / "neu.epub").write_bytes(b"x")
    new_files = watcher.scan()
    assert len(new_files) == 1
    assert new_files[0].endswith("neu.epub")


def test_scan_without_prime_treats_everything_as_new(tmp_path):
    (tmp_path / "a.epub").write_bytes(b"x")
    (tmp_path / "b.pdf").write_bytes(b"x")
    (tmp_path / "ignoriert.txt").write_bytes(b"x")
    watcher = FolderWatcher(str(tmp_path))
    assert len(watcher.scan()) == 2


def test_scan_on_missing_folder_returns_empty(tmp_path):
    watcher = FolderWatcher(str(tmp_path / "existiert-nicht"))
    assert watcher.scan() == []


def test_run_without_process_existing_ignores_files_present_at_start(tmp_path, monkeypatch):
    monkeypatch.setattr(time, "sleep", lambda seconds: None)
    (tmp_path / "vorhanden.epub").write_bytes(b"x")
    watcher = FolderWatcher(str(tmp_path))

    seen: list[str] = []
    watcher.run(seen.append, iterations=1, process_existing=False)
    assert seen == []


def test_run_detects_file_added_after_first_iteration(tmp_path, monkeypatch):
    monkeypatch.setattr(time, "sleep", lambda seconds: None)
    watcher = FolderWatcher(str(tmp_path))

    seen: list[str] = []
    watcher.run(seen.append, iterations=1)
    (tmp_path / "neu.epub").write_bytes(b"x")
    watcher.run(seen.append, iterations=1)

    assert len(seen) == 1
    assert seen[0].endswith("neu.epub")


def test_run_with_process_existing_reports_existing_files(tmp_path, monkeypatch):
    monkeypatch.setattr(time, "sleep", lambda seconds: None)
    (tmp_path / "vorhanden.epub").write_bytes(b"x")
    watcher = FolderWatcher(str(tmp_path))

    seen: list[str] = []
    watcher.run(seen.append, iterations=1, process_existing=True)
    assert len(seen) == 1
