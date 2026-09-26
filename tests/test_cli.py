from __future__ import annotations

import pytest

from kindle_meta import cli, enrich, llm, providers, sendmail
from kindle_meta.readers import read_metadata


@pytest.fixture(autouse=True)
def _isolated_home(tmp_path, monkeypatch):
    monkeypatch.setenv("KINDLE_META_HOME", str(tmp_path))


@pytest.fixture(autouse=True)
def _no_network(monkeypatch):
    monkeypatch.setattr(providers, "search_by_isbn", lambda isbn: [])
    monkeypatch.setattr(providers, "search", lambda *a, **k: [])


def test_cli_info_prints_metadata(sample_epub, capsys):
    exit_code = cli.main(["info", sample_epub])
    captured = capsys.readouterr()
    assert exit_code == 0
    assert "Die Beispielreise" in captured.out
    assert "Anna Musterfrau" in captured.out
    assert "Testserie" in captured.out


def test_cli_info_unsupported_format_prints_error(tmp_path, capsys):
    path = tmp_path / "buch.txt"
    path.write_text("kein E-Book")
    exit_code = cli.main(["info", str(path)])
    captured = capsys.readouterr()
    assert exit_code == 1
    assert captured.err.startswith("Fehler:")


def test_cli_enrich_without_results(sample_epub, capsys):
    exit_code = cli.main(["enrich", sample_epub, "--no-llm"])
    captured = capsys.readouterr()
    assert exit_code == 0
    assert "Keine Vorschläge" in captured.out


def test_cli_enrich_lists_suggestions(monkeypatch, sample_epub, capsys):
    from kindle_meta.models import BookMetadata

    monkeypatch.setattr(
        providers,
        "search",
        lambda *a, **k: [BookMetadata(title="Die Beispielreise", authors=["Anna Musterfrau"])],
    )
    exit_code = cli.main(["enrich", sample_epub, "--no-llm"])
    captured = capsys.readouterr()
    assert exit_code == 0
    assert "1. Die Beispielreise" in captured.out


def test_cli_apply_writes_metadata_and_records_in_library(sample_epub, capsys):
    exit_code = cli.main(["apply", sample_epub, "--title", "Neuer Titel"])
    captured = capsys.readouterr()
    assert exit_code == 0
    assert "Geschrieben:" in captured.out

    reread = read_metadata(sample_epub)
    assert reread.title == "Neuer Titel"

    from kindle_meta.library import Library

    with Library() as lib:
        assert lib.get(sample_epub) is not None


def test_cli_apply_with_overrides(sample_epub):
    cli.main(
        [
            "apply",
            sample_epub,
            "--title",
            "X",
            "--author",
            "Erste Autorin, Zweiter Autor",
            "--series",
            "Neue Serie",
            "--series-index",
            "5",
        ]
    )
    reread = read_metadata(sample_epub)
    assert reread.authors == ["Erste Autorin", "Zweiter Autor"]
    assert reread.series == "Neue Serie"
    assert reread.series_index == 5.0


def test_cli_apply_ai_check_warns_but_still_writes(monkeypatch, sample_epub, capsys):
    monkeypatch.setattr(
        llm,
        "review_metadata",
        lambda meta: llm.QualityReport(
            ok=False, issues=[llm.QualityIssue(field="isbn", message="ISBN unklar")]
        ),
    )
    exit_code = cli.main(["apply", sample_epub, "--ai-check"])
    captured = capsys.readouterr()
    assert exit_code == 0
    assert "KI-Hinweis" in captured.err
    assert "Geschrieben:" in captured.out


def test_cli_apply_strict_ai_check_blocks_write(monkeypatch, sample_epub, capsys):
    monkeypatch.setattr(
        llm,
        "review_metadata",
        lambda meta: llm.QualityReport(
            ok=False, issues=[llm.QualityIssue(field="isbn", message="ISBN unklar")]
        ),
    )
    original = read_metadata(sample_epub)

    exit_code = cli.main(
        ["apply", sample_epub, "--strict-ai-check", "--title", "Sollte nicht stehen"]
    )
    captured = capsys.readouterr()
    assert exit_code == 1
    assert "KI-Hinweis" in captured.err
    assert "Abgebrochen" in captured.err

    unchanged = read_metadata(sample_epub)
    assert unchanged.title == original.title


def test_cli_batch_writes_each_file(sample_epub, capsys):
    exit_code = cli.main(["batch", sample_epub, "--apply", "--no-llm"])
    captured = capsys.readouterr()
    assert exit_code == 0
    assert "Keine Vorschläge" in captured.out or "Geschrieben" in captured.out


def test_cli_batch_reports_errors_with_nonzero_exit(tmp_path, capsys):
    missing = str(tmp_path / "fehlt.epub")
    exit_code = cli.main(["batch", missing, "--no-llm"])
    captured = capsys.readouterr()
    assert exit_code == 1
    assert captured.err.startswith("Fehler:")


def test_cli_convert_delegates_to_calibre(monkeypatch, capsys):
    from kindle_meta import writers

    monkeypatch.setattr(
        writers, "convert_with_calibre", lambda src, out_ext="azw3": f"{src}.{out_ext}"
    )
    exit_code = cli.main(["convert", "buch.epub", "--to", "azw3"])
    captured = capsys.readouterr()
    assert exit_code == 0
    assert "Konvertiert: buch.epub.azw3" in captured.out


def test_cli_send_delegates_to_sendmail_and_records_status(monkeypatch, tmp_path, capsys):
    path = tmp_path / "buch.epub"
    path.write_bytes(b"x")
    calls = []
    monkeypatch.setattr(
        sendmail, "send_to_kindle", lambda p, to, config=None: calls.append((p, to))
    )

    exit_code = cli.main(["send", str(path), "--to", "kindle@kindle.com"])
    captured = capsys.readouterr()
    assert exit_code == 0
    assert calls == [(str(path), "kindle@kindle.com")]
    assert "Gesendet an: kindle@kindle.com" in captured.out

    from kindle_meta.library import STATUS_SENT, Library

    with Library() as lib:
        assert lib.get_status(str(path)) == STATUS_SENT


def test_cli_undo_restores_backup(sample_epub, capsys):
    from kindle_meta import backup

    backup.create_backup(sample_epub)
    with open(sample_epub, "r+b") as fh:
        fh.write(b"kaputt")

    exit_code = cli.main(["undo", sample_epub])
    captured = capsys.readouterr()
    assert exit_code == 0
    assert "Wiederhergestellt" in captured.out


def test_cli_undo_without_backup_prints_error(tmp_path, capsys):
    path = tmp_path / "buch.epub"
    path.write_bytes(b"x")
    exit_code = cli.main(["undo", str(path)])
    captured = capsys.readouterr()
    assert exit_code == 1
    assert captured.err.startswith("Fehler:")


def test_cli_library_empty(capsys):
    exit_code = cli.main(["library"])
    captured = capsys.readouterr()
    assert exit_code == 0
    assert "Keine Bücher" in captured.out


def test_cli_library_lists_books(sample_epub, capsys):
    cli.main(["apply", sample_epub])
    exit_code = cli.main(["library"])
    captured = capsys.readouterr()
    assert exit_code == 0
    assert "Die Beispielreise" in captured.out


def test_cli_library_with_query_falls_back_without_llm(sample_epub, capsys):
    cli.main(["apply", sample_epub])
    exit_code = cli.main(["library", "--query", "Beispielreise"])
    captured = capsys.readouterr()
    assert exit_code == 0
    assert "Die Beispielreise" in captured.out


def test_cli_duplicates_reports_none_for_empty_library(capsys):
    exit_code = cli.main(["duplicates"])
    captured = capsys.readouterr()
    assert exit_code == 0
    assert "Keine Dubletten" in captured.out


def test_cli_duplicates_reports_groups(sample_epub, tmp_path, capsys):
    import shutil

    copy_path = tmp_path / "kopie.epub"
    shutil.copyfile(sample_epub, copy_path)

    cli.main(["apply", sample_epub])
    cli.main(["apply", str(copy_path)])

    exit_code = cli.main(["duplicates"])
    captured = capsys.readouterr()
    assert exit_code == 0
    assert "Gruppe 1" in captured.out


def test_cli_series_check_reports_none_for_empty_library(capsys):
    exit_code = cli.main(["series-check"])
    captured = capsys.readouterr()
    assert exit_code == 0
    assert "Keine Serien-Probleme" in captured.out


def test_cli_series_check_reports_issue(sample_epub, capsys):
    cli.main(["apply", sample_epub])
    # Zweites Buch derselben Serie ohne Bandnummer erzeugt eine Inkonsistenz.
    from kindle_meta.library import Library
    from kindle_meta.models import BookMetadata

    with Library() as lib:
        lib.upsert(
            BookMetadata(title="Band ohne Nummer", series="Testserie", source_path="/anderes.epub")
        )

    exit_code = cli.main(["series-check"])
    captured = capsys.readouterr()
    assert exit_code == 0
    assert "Testserie" in captured.out


def test_cmd_watch_reports_written_files(monkeypatch, tmp_path, capsys):
    from kindle_meta import watch

    class FakeWatcher:
        def __init__(self, folder):
            self.folder = folder

        def run(self, callback, *, interval, iterations=None, process_existing):
            callback("/neu/buch.epub")

    monkeypatch.setattr(watch, "FolderWatcher", FakeWatcher)
    monkeypatch.setattr(
        enrich,
        "enrich_batch",
        lambda paths, **kwargs: [
            enrich.BatchOutcome(path=paths[0], result=None, written_to="/neu/buch.epub", error=None)
        ],
    )

    exit_code = cli.main(["watch", str(tmp_path), "--apply"])
    captured = capsys.readouterr()
    assert exit_code == 0
    assert "Neu erkannt: /neu/buch.epub" in captured.out
    assert "Geschrieben: /neu/buch.epub" in captured.out


def test_cmd_watch_reports_batch_errors(monkeypatch, tmp_path, capsys):
    from kindle_meta import watch

    class FakeWatcher:
        def __init__(self, folder):
            pass

        def run(self, callback, *, interval, iterations=None, process_existing):
            callback("/neu/kaputt.epub")

    monkeypatch.setattr(watch, "FolderWatcher", FakeWatcher)
    monkeypatch.setattr(
        enrich,
        "enrich_batch",
        lambda paths, **kwargs: [
            enrich.BatchOutcome(path=paths[0], result=None, written_to=None, error="kaputt")
        ],
    )

    exit_code = cli.main(["watch", str(tmp_path), "--apply"])
    captured = capsys.readouterr()
    assert exit_code == 0
    assert "kaputt" in captured.err
