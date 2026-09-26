from __future__ import annotations

import io

import pytest
from PIL import Image
from PySide6.QtCore import QRect
from PySide6.QtWidgets import QDialog, QMessageBox

from kindle_meta import enrich, llm, providers
from kindle_meta.gui.app import (
    CompareDialog,
    CropDialog,
    DuplicatesDialog,
    MainWindow,
    QualityDialog,
    SeriesCheckDialog,
    SettingsDialog,
    _map_rect_to_image,
)
from kindle_meta.models import BookMetadata


@pytest.fixture(autouse=True)
def _isolated_home(tmp_path, monkeypatch):
    monkeypatch.setenv("KINDLE_META_HOME", str(tmp_path))


@pytest.fixture(autouse=True)
def _no_network(monkeypatch):
    monkeypatch.setattr(providers, "search_by_isbn", lambda isbn: [])
    monkeypatch.setattr(providers, "search", lambda *a, **k: [])


def _run_pending(qapp, thread_pool, timeout_ms: int = 3000) -> None:
    thread_pool.waitForDone(timeout_ms)
    for _ in range(20):
        qapp.processEvents()


def _jpeg_bytes(color=(200, 50, 50), size=(400, 600)) -> bytes:
    img = Image.new("RGB", size, color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


# --- MainWindow: Dateien & Formular --------------------------------------


def test_main_window_starts_with_empty_edit_form(qapp, no_modal_dialogs):
    window = MainWindow()
    assert window.title_edit.text() == ""
    assert window.files == []


def test_add_files_and_select_loads_metadata(qapp, no_modal_dialogs, sample_epub):
    window = MainWindow()
    window.add_files([sample_epub])
    assert window.files == [sample_epub]
    assert window.current_path == sample_epub
    assert window.title_edit.text() == "Die Beispielreise"
    assert window.author_edit.text() == "Anna Musterfrau"
    assert window.series_edit.text() == "Testserie"


def test_remove_selected_removes_from_list(qapp, no_modal_dialogs, sample_epub):
    window = MainWindow()
    window.add_files([sample_epub])
    window.file_list.selectAll()
    window._on_remove_selected_clicked()
    assert window.files == []
    assert window.file_list.count() == 0


def test_load_unsupported_format_shows_warning(qapp, no_modal_dialogs, tmp_path):
    path = tmp_path / "buch.txt"
    path.write_text("kein E-Book")
    window = MainWindow()
    window._load_file(str(path))
    assert window.current_path is None


def test_form_to_meta_parses_authors_and_series_index(qapp, no_modal_dialogs, sample_epub):
    window = MainWindow()
    window.add_files([sample_epub])
    window.author_edit.setText("Erste Autorin, Zweiter Autor")
    window.series_index_edit.setText("3.5")
    meta = window._form_to_meta()
    assert meta.authors == ["Erste Autorin", "Zweiter Autor"]
    assert meta.series_index == 3.5


def test_form_to_meta_invalid_series_index_becomes_none(qapp, no_modal_dialogs, sample_epub):
    window = MainWindow()
    window.add_files([sample_epub])
    window.series_index_edit.setText("keine-zahl")
    meta = window._form_to_meta()
    assert meta.series_index is None


# --- MainWindow: Anreichern/Vorschläge ------------------------------------


def test_enrich_finished_populates_suggestions_and_covers(qapp, no_modal_dialogs, sample_epub):
    window = MainWindow()
    window.add_files([sample_epub])
    original = window.current_meta
    suggestion = BookMetadata(
        title="Die Beispielreise", authors=["Anna Musterfrau"], publisher="Anderer Verlag"
    )
    result = enrich.EnrichmentResult(original=original, suggestions=[suggestion], used_llm=False)

    window._on_enrich_finished(result)

    assert window.suggestion_combo.count() == 1
    assert "Die Beispielreise" in window.suggestion_combo.itemText(0)


def test_enrich_via_thread_pool_end_to_end(qapp, no_modal_dialogs, monkeypatch, sample_epub):
    window = MainWindow()
    window.add_files([sample_epub])

    suggestion = BookMetadata(title="Aus dem Netz", authors=["Autor X"])
    monkeypatch.setattr(
        enrich, "enrich_file", lambda path, use_llm=True: enrich.EnrichmentResult(
            original=window.current_meta, suggestions=[suggestion], used_llm=False
        )
    )

    window._on_enrich_clicked()
    _run_pending(qapp, window.thread_pool)

    assert window.suggestion_combo.count() == 1


def test_suggestion_selection_updates_form(qapp, no_modal_dialogs, sample_epub):
    window = MainWindow()
    window.add_files([sample_epub])
    original = window.current_meta
    suggestion = BookMetadata(title="Neuer Titel aus Vorschlag", authors=["Anna Musterfrau"])
    result = enrich.EnrichmentResult(original=original, suggestions=[suggestion], used_llm=False)
    window._on_enrich_finished(result)

    window.suggestion_combo.setCurrentIndex(0)
    assert window.title_edit.text() == "Neuer Titel aus Vorschlag"


def test_ai_query_without_available_llm_shows_info(
    qapp, no_modal_dialogs, monkeypatch, sample_epub
):
    window = MainWindow()
    window.add_files([sample_epub])
    monkeypatch.setattr(llm, "available", lambda: False)

    calls = []
    monkeypatch.setattr(QMessageBox, "information", staticmethod(lambda *a, **k: calls.append(a)))
    window._on_ai_query_clicked()
    assert len(calls) == 1


def test_ai_query_finished_adds_prefixed_suggestion(qapp, no_modal_dialogs, sample_epub):
    window = MainWindow()
    window.add_files([sample_epub])
    window._on_ai_query_finished(
        {
            "title": "KI-Titel",
            "authors": ["KI-Autor"],
            "isbn": "",
            "series": "",
            "series_index": None,
        }
    )
    assert window.suggestion_combo.count() == 1
    assert window.suggestion_combo.itemText(0).startswith("🤖 KI:")
    assert 0 in window._ai_ids


def test_ai_query_finished_with_no_result_sets_status(qapp, no_modal_dialogs, sample_epub):
    window = MainWindow()
    window.add_files([sample_epub])
    window._on_ai_query_finished(None)
    assert window.suggestion_combo.count() == 0


def test_compare_dialog_merges_selected_values(qapp):
    original = BookMetadata(title="Original", authors=["Original Autor"])
    candidate = BookMetadata(title="Kandidat", authors=["Kandidat Autor"], publisher="Verlag X")
    dialog = CompareDialog(original, [candidate])

    dialog._combos["title"].setCurrentText("Kandidat")
    dialog._combos["publisher"].setCurrentText("Verlag X")
    merged = dialog.result_metadata()
    assert merged.title == "Kandidat"
    assert merged.publisher == "Verlag X"


def test_compare_button_without_suggestions_shows_info(
    qapp, no_modal_dialogs, monkeypatch, sample_epub
):
    window = MainWindow()
    window.add_files([sample_epub])
    calls = []
    monkeypatch.setattr(QMessageBox, "information", staticmethod(lambda *a, **k: calls.append(a)))
    window._on_compare_clicked()
    assert len(calls) == 1


# --- MainWindow: Cover ----------------------------------------------------


def test_rotate_updates_cover_dimensions(qapp, no_modal_dialogs, sample_epub):
    window = MainWindow()
    window.add_files([sample_epub])
    original_cover = window.current_cover

    window._on_rotate_clicked(90)
    assert window.current_cover != original_cover


def test_cover_candidate_selection_updates_current_cover(qapp, no_modal_dialogs, sample_epub):
    window = MainWindow()
    window.add_files([sample_epub])
    candidate = enrich.CoverCandidate("Testcover", b"neue-cover-bytes", "image/jpeg")
    window.cover_combo.addItem(candidate.label, candidate)
    window.cover_combo.setCurrentIndex(0)
    assert window.current_cover == b"neue-cover-bytes"


def test_map_rect_to_image_scales_correctly():
    box = _map_rect_to_image(QRect(0, 0, 50, 50), (100, 100), (200, 200))
    assert box == (0, 0, 100, 100)


def test_map_rect_to_image_handles_zero_display_size():
    box = _map_rect_to_image(QRect(0, 0, 10, 10), (0, 0), (200, 200))
    assert box == (0, 0, 200, 200)


def test_crop_dialog_cropped_data_uses_selected_rect(qapp):
    data = _jpeg_bytes(size=(200, 200))
    dialog = CropDialog(data)
    dialog._label.selected_rect = QRect(10, 10, 100, 100)
    cropped = dialog.cropped_data()
    img = Image.open(io.BytesIO(cropped))
    assert img.width == 100
    assert img.height == 100


def test_crop_dialog_without_selection_returns_original(qapp):
    data = _jpeg_bytes(size=(200, 200))
    dialog = CropDialog(data)
    assert dialog.cropped_data() == data


# --- MainWindow: Speichern/KI-Qualitätsprüfung ----------------------------


def test_save_writes_metadata_and_updates_library(qapp, no_modal_dialogs, sample_epub):
    from kindle_meta.library import Library
    from kindle_meta.readers import read_metadata

    window = MainWindow()
    window.add_files([sample_epub])
    window.title_edit.setText("Per GUI gespeichert")
    window.ai_check_checkbox.setChecked(False)

    window._on_save_clicked()
    _run_pending(qapp, window.thread_pool)

    reread = read_metadata(sample_epub)
    assert reread.title == "Per GUI gespeichert"
    with Library() as lib:
        assert lib.get(sample_epub) is not None


def test_maybe_run_ai_check_skips_when_checkbox_off(qapp, no_modal_dialogs, sample_epub):
    window = MainWindow()
    window.add_files([sample_epub])
    window.ai_check_checkbox.setChecked(False)
    assert window._maybe_run_ai_check(window.current_meta) is True


def test_maybe_run_ai_check_returns_true_when_ok(qapp, no_modal_dialogs, monkeypatch, sample_epub):
    window = MainWindow()
    window.add_files([sample_epub])
    window.ai_check_checkbox.setChecked(True)
    monkeypatch.setattr(llm, "available", lambda: True)
    monkeypatch.setattr(llm, "review_metadata", lambda meta: llm.QualityReport(ok=True, issues=[]))
    assert window._maybe_run_ai_check(window.current_meta) is True


def test_maybe_run_ai_check_opens_dialog_and_respects_cancel(
    qapp, no_modal_dialogs, monkeypatch, sample_epub
):
    window = MainWindow()
    window.add_files([sample_epub])
    window.ai_check_checkbox.setChecked(True)
    monkeypatch.setattr(llm, "available", lambda: True)
    report = llm.QualityReport(
        ok=False, issues=[llm.QualityIssue(field="isbn", message="Passt nicht")]
    )
    monkeypatch.setattr(llm, "review_metadata", lambda meta: report)
    monkeypatch.setattr(QDialog, "exec", lambda self: QDialog.DialogCode.Rejected)

    assert window._maybe_run_ai_check(window.current_meta) is False


def test_quality_dialog_shows_issue_text(qapp):
    from PySide6.QtWidgets import QPlainTextEdit

    report = llm.QualityReport(
        ok=False, issues=[llm.QualityIssue(field="isbn", message="ISBN unklar", suggestion="123")]
    )
    dialog = QualityDialog(report)
    assert dialog.windowTitle() == "KI-Qualitätsprüfung"
    text_widget = dialog.findChild(QPlainTextEdit)
    assert "ISBN unklar" in text_widget.toPlainText()


# --- Bibliothek-Tab ---------------------------------------------------------


def test_library_tab_lists_upserted_books(qapp, no_modal_dialogs, sample_epub):
    from kindle_meta.library import Library

    with Library() as lib:
        lib.upsert(BookMetadata(title="Bib-Buch", source_path=sample_epub))

    window = MainWindow()
    assert window.library_list.count() == 1
    assert window.library_list.item(0).text() == "Bib-Buch"


def test_library_search_filters_results(qapp, no_modal_dialogs):
    from kindle_meta.library import Library

    with Library() as lib:
        lib.upsert(BookMetadata(title="Findbar", source_path="/a.epub"))
        lib.upsert(BookMetadata(title="Anderes", source_path="/b.epub"))

    window = MainWindow()
    window.library_search_edit.setText("Findbar")
    window._on_library_search_clicked()
    assert window.library_list.count() == 1
    assert window.library_list.item(0).text() == "Findbar"


def test_library_double_click_opens_in_editor(qapp, no_modal_dialogs, sample_epub):
    from kindle_meta.library import Library

    with Library() as lib:
        lib.upsert(BookMetadata(title="Die Beispielreise", source_path=sample_epub))

    window = MainWindow()
    item = window.library_list.item(0)
    window._on_library_item_double_clicked(item)

    assert window.tabs.currentIndex() == 0
    assert window.current_path == sample_epub


def test_find_duplicates_dialog_lists_groups(qapp, no_modal_dialogs):
    a = BookMetadata(title="X", isbn="9783161484100", source_path="/a.epub")
    b = BookMetadata(title="X", isbn="9783161484100", source_path="/b.epub")
    dialog = DuplicatesDialog([[a, b]])
    assert len(dialog._checkboxes) == 2


def test_series_check_dialog_lists_issues(qapp):
    from kindle_meta.series import SeriesIssue

    issue = SeriesIssue(series="S", kind="missing_index", message="Fehlt", books=[])
    dialog = SeriesCheckDialog([issue])
    assert dialog.list_widget.count() == 1


def test_settings_dialog_save_persists_values(qapp, tmp_path, monkeypatch):
    monkeypatch.setenv("KINDLE_META_HOME", str(tmp_path))
    from kindle_meta.config import Settings

    settings = Settings()
    dialog = SettingsDialog(settings)
    dialog._edits["kindle_addr"].setText("meinkindle@kindle.com")
    dialog.save()

    reloaded = Settings()
    assert reloaded.get("kindle_addr") == "meinkindle@kindle.com"
