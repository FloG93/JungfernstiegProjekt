"""PySide6-Oberfläche für kindle-meta (`kindle-meta-gui`)."""

from __future__ import annotations

import sys
from dataclasses import replace as dataclass_replace
from pathlib import Path

from PySide6.QtCore import QObject, QRect, QRunnable, QSize, Qt, QThreadPool, Signal, Slot
from PySide6.QtGui import QIcon, QPixmap
from PySide6.QtWidgets import (
    QAbstractItemView,
    QApplication,
    QCheckBox,
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QFileDialog,
    QFormLayout,
    QHBoxLayout,
    QInputDialog,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMessageBox,
    QPlainTextEdit,
    QProgressBar,
    QPushButton,
    QRubberBand,
    QStatusBar,
    QTabWidget,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

from kindle_meta import (
    covers,
    duplicates,
    enrich,
    library,
    llm,
    profile,
    providers,
    sendmail,
    series,
)
from kindle_meta.models import BookMetadata
from kindle_meta.readers import UnsupportedFormat, read_metadata
from kindle_meta.writers import write_metadata

# --- Hintergrund-Worker (QThreadPool) ---------------------------------


class WorkerSignals(QObject):
    finished = Signal(object)
    error = Signal(str)


class Worker(QRunnable):
    """Führt `fn(*args, **kwargs)` im Hintergrund aus."""

    def __init__(self, fn, *args, **kwargs):
        super().__init__()
        self.fn = fn
        self.args = args
        self.kwargs = kwargs
        self.signals = WorkerSignals()

    @Slot()
    def run(self) -> None:
        try:
            result = self.fn(*self.args, **self.kwargs)
        except Exception as exc:  # noqa: BLE001 - Fehler dem UI-Thread melden
            self.signals.error.emit(str(exc))
        else:
            self.signals.finished.emit(result)


class BatchWorkerSignals(QObject):
    progress = Signal(int, int, str, object)
    finished = Signal(list)
    error = Signal(str)


class BatchWorker(QRunnable):
    """Führt `enrich.enrich_batch` im Hintergrund aus, mit Fortschritt/Abbruch."""

    def __init__(self, paths: list[str], **kwargs):
        super().__init__()
        self.paths = paths
        self.kwargs = kwargs
        self.signals = BatchWorkerSignals()
        self._cancelled = False

    def cancel(self) -> None:
        self._cancelled = True

    @Slot()
    def run(self) -> None:
        try:
            outcomes = enrich.enrich_batch(
                self.paths,
                progress=lambda i, total, path, outcome: self.signals.progress.emit(
                    i, total, path, outcome
                ),
                should_cancel=lambda: self._cancelled,
                **self.kwargs,
            )
        except Exception as exc:  # noqa: BLE001
            self.signals.error.emit(str(exc))
        else:
            self.signals.finished.emit(outcomes)


# --- Dialoge -----------------------------------------------------------


class SettingsDialog(QDialog):
    """Einstellungen-Dialog: ein Zeilenfeld je Settings-Schlüssel."""

    _FIELDS = [
        ("kindle_addr", "Kindle-E-Mail-Adresse", False),
        ("smtp_host", "SMTP-Host", False),
        ("smtp_port", "SMTP-Port", False),
        ("smtp_user", "SMTP-Benutzer", False),
        ("smtp_pass", "SMTP-Passwort", True),
        ("smtp_from", "Absenderadresse", False),
        ("protected_fields", "Geschützte Felder", False),
        ("llm_model_fast", "KI-Modell (schnell)", False),
        ("llm_model_research", "KI-Modell (Recherche)", False),
    ]

    def __init__(self, settings, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Einstellungen")
        self._settings = settings
        self._edits: dict[str, QLineEdit] = {}

        layout = QFormLayout(self)
        for key, label, is_secret in self._FIELDS:
            edit = QLineEdit(str(settings.get(key, "") or ""), self)
            if is_secret:
                edit.setEchoMode(QLineEdit.EchoMode.Password)
            layout.addRow(label, edit)
            self._edits[key] = edit

        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Save | QDialogButtonBox.StandardButton.Cancel, self
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addRow(buttons)

    def save(self) -> None:
        for key, edit in self._edits.items():
            self._settings.set(key, edit.text())


class CompareDialog(QDialog):
    """Pro Feld editierbare Combo mit allen Kandidatenwerten."""

    _FIELDS = [
        ("title", "Titel"),
        ("author_str", "Autor(en)"),
        ("publisher", "Verlag"),
        ("published", "Datum"),
        ("isbn", "ISBN"),
        ("language", "Sprache"),
        ("series", "Serie"),
        ("series_index", "Serien-Nr."),
        ("description", "Beschreibung"),
    ]

    def __init__(self, original: BookMetadata, candidates: list[BookMetadata], parent=None):
        super().__init__(parent)
        self.setWindowTitle("Vergleichen")
        self._original = original
        self._combos: dict[str, QComboBox] = {}

        layout = QFormLayout(self)
        all_meta = [original, *candidates]
        for field_name, label in self._FIELDS:
            combo = QComboBox(self)
            combo.setEditable(True)
            seen: set[str] = set()
            for meta in all_meta:
                text = self._format_value(field_name, getattr(meta, field_name))
                if text and text not in seen:
                    combo.addItem(text)
                    seen.add(text)
            if combo.count() == 0:
                combo.addItem("")
            layout.addRow(label, combo)
            self._combos[field_name] = combo

        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel, self
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addRow(buttons)

    @staticmethod
    def _format_value(field_name: str, value: object) -> str:
        if field_name == "series_index":
            return "" if value is None else f"{value:g}"
        return str(value or "")

    def result_metadata(self) -> BookMetadata:
        updates: dict[str, object] = {}
        for field_name, _ in self._FIELDS:
            text = self._combos[field_name].currentText().strip()
            if field_name == "author_str":
                updates["authors"] = [a.strip() for a in text.split(",") if a.strip()]
            elif field_name == "series_index":
                try:
                    updates["series_index"] = float(text) if text else None
                except ValueError:
                    updates["series_index"] = None
            else:
                updates[field_name] = text
        return dataclass_replace(self._original, **updates)


def _map_rect_to_image(
    display_rect: QRect, display_size: tuple[int, int], image_size: tuple[int, int]
) -> tuple[int, int, int, int]:
    """Rechnet ein Auswahlrechteck von Anzeige- auf Originalkoordinaten hoch."""
    disp_w, disp_h = display_size
    img_w, img_h = image_size
    if disp_w <= 0 or disp_h <= 0:
        return (0, 0, img_w, img_h)
    scale_x = img_w / disp_w
    scale_y = img_h / disp_h
    left = max(0, int(display_rect.x() * scale_x))
    top = max(0, int(display_rect.y() * scale_y))
    right = min(img_w, int((display_rect.x() + display_rect.width()) * scale_x))
    bottom = min(img_h, int((display_rect.y() + display_rect.height()) * scale_y))
    return (left, top, right, bottom)


class _CropLabel(QLabel):
    """Zeigt das Cover an und lässt per Maus ein Rechteck aufziehen (QRubberBand)."""

    def __init__(self, pixmap: QPixmap, parent=None):
        super().__init__(parent)
        self.setPixmap(pixmap)
        self._origin = None
        self._rubber_band = QRubberBand(QRubberBand.Shape.Rectangle, self)
        self.selected_rect = QRect()

    def mousePressEvent(self, event) -> None:
        self._origin = event.pos()
        self._rubber_band.setGeometry(QRect(self._origin, event.pos()))
        self._rubber_band.show()

    def mouseMoveEvent(self, event) -> None:
        if self._origin is not None:
            self._rubber_band.setGeometry(QRect(self._origin, event.pos()).normalized())

    def mouseReleaseEvent(self, event) -> None:
        if self._origin is not None:
            self.selected_rect = QRect(self._origin, event.pos()).normalized()
            self._origin = None


class CropDialog(QDialog):
    """Zuschneiden-Dialog: Auswahl per Maus, Anzeige auf Originalkoordinaten hochrechnen."""

    def __init__(self, cover_data: bytes, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Zuschneiden")
        self._cover_data = cover_data

        pixmap = QPixmap()
        pixmap.loadFromData(cover_data)
        self._original_size = (pixmap.width(), pixmap.height())
        self._label = _CropLabel(pixmap, self)

        layout = QVBoxLayout(self)
        layout.addWidget(self._label)
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel, self
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def cropped_data(self) -> bytes:
        rect = self._label.selected_rect
        if rect.isNull() or rect.width() == 0 or rect.height() == 0:
            return self._cover_data
        display_size = (self._label.pixmap().width(), self._label.pixmap().height())
        box = _map_rect_to_image(rect, display_size, self._original_size)
        return covers.crop(self._cover_data, box)


class QualityDialog(QDialog):
    """Zeigt die KI-Qualitätsprüfung vor dem Speichern."""

    def __init__(self, report: llm.QualityReport, parent=None):
        super().__init__(parent)
        self.setWindowTitle("KI-Qualitätsprüfung")

        layout = QVBoxLayout(self)
        text = QPlainTextEdit(self)
        text.setReadOnly(True)
        lines = [
            f"[{issue.field}] {issue.message}"
            + (f" (Vorschlag: {issue.suggestion})" if issue.suggestion else "")
            for issue in report.issues
        ]
        text.setPlainText("\n".join(lines) or "Keine Probleme gefunden.")
        layout.addWidget(text)

        buttons = QDialogButtonBox(self)
        buttons.addButton("Trotzdem speichern", QDialogButtonBox.ButtonRole.AcceptRole)
        buttons.addButton("Abbrechen", QDialogButtonBox.ButtonRole.RejectRole)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)


class DuplicatesDialog(QDialog):
    """Listet Dubletten-Gruppen mit Checkboxen zum Entfernen."""

    def __init__(self, groups: list[list[BookMetadata]], parent=None):
        super().__init__(parent)
        self.setWindowTitle("Duplikate")
        self._checkboxes: list[tuple[BookMetadata, QCheckBox]] = []

        layout = QVBoxLayout(self)
        if not groups:
            layout.addWidget(QLabel("Keine Duplikate gefunden."))
        for i, group in enumerate(groups, start=1):
            layout.addWidget(QLabel(f"Gruppe {i}:"))
            for book in group:
                checkbox = QCheckBox(f"{book.title} [{book.source_path}]", self)
                layout.addWidget(checkbox)
                self._checkboxes.append((book, checkbox))

        self.remove_button = QPushButton("Ausgewählte entfernen", self)
        layout.addWidget(self.remove_button)
        close_button = QPushButton("Schließen", self)
        close_button.clicked.connect(self.accept)
        layout.addWidget(close_button)

    def selected_books(self) -> list[BookMetadata]:
        return [book for book, checkbox in self._checkboxes if checkbox.isChecked()]


class SeriesCheckDialog(QDialog):
    """Listet Serien-Inkonsistenzen."""

    def __init__(self, issues: list[series.SeriesIssue], parent=None):
        super().__init__(parent)
        self.setWindowTitle("Serien-Konsistenz")

        layout = QVBoxLayout(self)
        self.list_widget = QListWidget(self)
        for issue in issues:
            item = QListWidgetItem(f"[{issue.series}] {issue.message}")
            item.setData(Qt.ItemDataRole.UserRole, issue)
            self.list_widget.addItem(item)
        if not issues:
            self.list_widget.addItem("Keine Probleme gefunden.")
        layout.addWidget(self.list_widget)

        close_button = QPushButton("Schließen", self)
        close_button.clicked.connect(self.accept)
        layout.addWidget(close_button)


# --- Dateiliste mit Drag & Drop ------------------------------------------


class FileListWidget(QListWidget):
    filesDropped = Signal(list)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setAcceptDrops(True)
        self.setSelectionMode(QAbstractItemView.SelectionMode.ExtendedSelection)

    def dragEnterEvent(self, event) -> None:
        if event.mimeData().hasUrls():
            event.acceptProposedAction()

    def dragMoveEvent(self, event) -> None:
        if event.mimeData().hasUrls():
            event.acceptProposedAction()

    def dropEvent(self, event) -> None:
        paths = [url.toLocalFile() for url in event.mimeData().urls() if url.isLocalFile()]
        if paths:
            self.filesDropped.emit(paths)


# --- Hauptfenster -------------------------------------------------------


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("kindle-meta")
        self.thread_pool = QThreadPool.globalInstance()

        self.files: list[str] = []
        self.current_path: str | None = None
        self.current_meta: BookMetadata | None = None
        self.current_cover: bytes | None = None
        self.current_cover_mime: str = ""
        self.current_result: enrich.EnrichmentResult | None = None
        self._ai_ids: set[int] = set()
        self._batch_worker: BatchWorker | None = None
        self._active_workers: list[QRunnable] = []

        self._build_menu()

        self.tabs = QTabWidget()
        self.tabs.addTab(self._build_edit_tab(), "Bearbeiten")
        self.tabs.addTab(self._build_library_tab(), "Bibliothek")
        self.setCentralWidget(self.tabs)

        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)

    def _start_worker(self, worker: QRunnable) -> None:
        """Startet `worker` im Thread-Pool und hält eine Referenz, solange er
        läuft - ohne das würde Python das Worker-/Signals-Objekt oft schon
        einsammeln, bevor das Ergebnis-Signal im UI-Thread ankommt.
        """
        self._active_workers.append(worker)

        def _cleanup(*_args: object) -> None:
            if worker in self._active_workers:
                self._active_workers.remove(worker)

        worker.signals.finished.connect(_cleanup)
        worker.signals.error.connect(_cleanup)
        self.thread_pool.start(worker)

    # --- Aufbau ---------------------------------------------------------

    def _build_menu(self) -> None:
        menu_bar = self.menuBar()
        file_menu = menu_bar.addMenu("Datei")
        settings_action = file_menu.addAction("Einstellungen")
        settings_action.triggered.connect(self._on_settings_clicked)
        quit_action = file_menu.addAction("Beenden")
        quit_action.triggered.connect(self.close)

    def _build_edit_tab(self) -> QWidget:
        widget = QWidget()
        outer = QHBoxLayout(widget)

        left = QVBoxLayout()
        self.file_list = FileListWidget()
        self.file_list.filesDropped.connect(self.add_files)
        self.file_list.itemSelectionChanged.connect(self._on_file_selection_changed)
        left.addWidget(self.file_list)

        file_buttons = QHBoxLayout()
        remove_button = QPushButton("Ausgewählte entfernen")
        remove_button.clicked.connect(self._on_remove_selected_clicked)
        send_selected_button = QPushButton("Ausgewählte senden")
        send_selected_button.clicked.connect(self._on_send_clicked)
        file_buttons.addWidget(remove_button)
        file_buttons.addWidget(send_selected_button)
        left.addLayout(file_buttons)

        self.optimize_cover_checkbox = QCheckBox("Cover optimieren")
        self.backup_checkbox = QCheckBox("Backup vor Überschreiben")
        self.backup_checkbox.setChecked(True)
        self.ai_check_checkbox = QCheckBox("KI-Qualitätsprüfung vor dem Speichern")
        self.ai_check_checkbox.setChecked(llm.available())
        left.addWidget(self.optimize_cover_checkbox)
        left.addWidget(self.backup_checkbox)
        left.addWidget(self.ai_check_checkbox)

        self.batch_progress = QProgressBar()
        batch_start_button = QPushButton("Alle anreichern & speichern …")
        batch_start_button.clicked.connect(self._on_batch_start_clicked)
        batch_cancel_button = QPushButton("Abbrechen")
        batch_cancel_button.clicked.connect(self._on_batch_cancel_clicked)
        left.addWidget(batch_start_button)
        left.addWidget(self.batch_progress)
        left.addWidget(batch_cancel_button)

        outer.addLayout(left, 1)

        middle = QVBoxLayout()
        self.cover_label = QLabel("Kein Cover")
        self.cover_label.setFixedSize(160, 220)
        self.cover_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        middle.addWidget(self.cover_label)

        cover_buttons = QHBoxLayout()
        replace_button = QPushButton("Cover ersetzen")
        replace_button.clicked.connect(self._on_cover_replace_clicked)
        rotate_left_button = QPushButton("↺")
        rotate_left_button.clicked.connect(lambda: self._on_rotate_clicked(-90))
        rotate_right_button = QPushButton("↻")
        rotate_right_button.clicked.connect(lambda: self._on_rotate_clicked(90))
        crop_button = QPushButton("Zuschneiden …")
        crop_button.clicked.connect(self._on_crop_clicked)
        for button in (replace_button, rotate_left_button, rotate_right_button, crop_button):
            cover_buttons.addWidget(button)
        middle.addLayout(cover_buttons)

        self.cover_combo = QComboBox()
        self.cover_combo.currentIndexChanged.connect(self._on_cover_candidate_changed)
        middle.addWidget(self.cover_combo)

        outer.addLayout(middle, 1)

        right = QVBoxLayout()
        form = QFormLayout()
        self.title_edit = QLineEdit()
        self.author_edit = QLineEdit()
        self.publisher_edit = QLineEdit()
        self.published_edit = QLineEdit()
        self.isbn_edit = QLineEdit()
        self.language_edit = QLineEdit()
        self.series_edit = QLineEdit()
        self.series_index_edit = QLineEdit()
        self.description_edit = QTextEdit()
        form.addRow("Titel", self.title_edit)
        form.addRow("Autor(en)", self.author_edit)
        form.addRow("Verlag", self.publisher_edit)
        form.addRow("Datum", self.published_edit)
        form.addRow("ISBN", self.isbn_edit)
        form.addRow("Sprache", self.language_edit)
        form.addRow("Serie", self.series_edit)
        form.addRow("Serien-Nr.", self.series_index_edit)
        form.addRow("Beschreibung", self.description_edit)
        right.addLayout(form)

        self.suggestion_combo = QComboBox()
        self.suggestion_combo.currentIndexChanged.connect(self._on_suggestion_changed)
        right.addWidget(self.suggestion_combo)

        action_row = QHBoxLayout()
        enrich_button = QPushButton("Online suchen / anreichern")
        enrich_button.clicked.connect(self._on_enrich_clicked)
        ai_button = QPushButton("🤖 KI abfragen")
        ai_button.clicked.connect(self._on_ai_query_clicked)
        compare_button = QPushButton("Vergleichen …")
        compare_button.clicked.connect(self._on_compare_clicked)
        for button in (enrich_button, ai_button, compare_button):
            action_row.addWidget(button)
        right.addLayout(action_row)

        save_row = QHBoxLayout()
        save_button = QPushButton("Speichern")
        save_button.clicked.connect(self._on_save_clicked)
        send_button = QPushButton("An Kindle senden …")
        send_button.clicked.connect(self._on_send_clicked)
        save_row.addWidget(save_button)
        save_row.addWidget(send_button)
        right.addLayout(save_row)

        outer.addLayout(right, 2)
        return widget

    def _build_library_tab(self) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)

        search_row = QHBoxLayout()
        self.library_search_edit = QLineEdit()
        self.library_search_edit.setPlaceholderText(
            "Suche (auch natürlichsprachig, z. B. 'Bücher ohne Cover')"
        )
        search_button = QPushButton("Suchen")
        search_row.addWidget(self.library_search_edit)
        search_row.addWidget(search_button)
        layout.addLayout(search_row)

        self.library_list = QListWidget()
        self.library_list.setViewMode(QListWidget.ViewMode.IconMode)
        self.library_list.setIconSize(QSize(80, 120))
        self.library_list.setResizeMode(QListWidget.ResizeMode.Adjust)
        layout.addWidget(self.library_list)

        action_row = QHBoxLayout()
        duplicates_button = QPushButton("Duplikate finden…")
        series_button = QPushButton("Serien prüfen…")
        action_row.addWidget(duplicates_button)
        action_row.addWidget(series_button)
        layout.addLayout(action_row)

        search_button.clicked.connect(self._on_library_search_clicked)
        self.library_search_edit.returnPressed.connect(self._on_library_search_clicked)
        self.library_list.itemDoubleClicked.connect(self._on_library_item_double_clicked)
        duplicates_button.clicked.connect(self._on_find_duplicates_clicked)
        series_button.clicked.connect(self._on_check_series_clicked)

        self._refresh_library_list()
        return widget

    # --- Bearbeiten-Tab: Dateien -----------------------------------------

    def add_files(self, paths: list[str]) -> None:
        for path in paths:
            if path not in self.files:
                self.files.append(path)
                self.file_list.addItem(path)
        if paths and self.current_path is None:
            self.file_list.setCurrentRow(0)

    def _on_remove_selected_clicked(self) -> None:
        for item in self.file_list.selectedItems():
            path = item.text()
            if path in self.files:
                self.files.remove(path)
            self.file_list.takeItem(self.file_list.row(item))

    def _on_file_selection_changed(self) -> None:
        items = self.file_list.selectedItems()
        if not items:
            return
        self._load_file(items[0].text())

    def _load_file(self, path: str) -> None:
        try:
            meta = read_metadata(path)
        except UnsupportedFormat as exc:
            QMessageBox.warning(self, "Nicht unterstützt", str(exc))
            return
        except Exception as exc:  # noqa: BLE001
            QMessageBox.critical(self, "Fehler", str(exc))
            return
        self.current_path = path
        self._populate_form(meta)

    # --- Bearbeiten-Tab: Formular -----------------------------------------

    def _fill_form_fields(self, meta: BookMetadata) -> None:
        self.title_edit.setText(meta.title)
        self.author_edit.setText(meta.author_str)
        self.publisher_edit.setText(meta.publisher)
        self.published_edit.setText(meta.published)
        self.isbn_edit.setText(meta.isbn)
        self.language_edit.setText(meta.language)
        self.series_edit.setText(meta.series)
        self.series_index_edit.setText(
            "" if meta.series_index is None else f"{meta.series_index:g}"
        )
        self.description_edit.setPlainText(meta.description)

    def _populate_form(self, meta: BookMetadata) -> None:
        self.current_meta = meta
        self.current_cover = meta.cover
        self.current_cover_mime = meta.cover_mime
        self._fill_form_fields(meta)
        self._update_cover_preview()
        self.suggestion_combo.clear()
        self._ai_ids.clear()
        self.cover_combo.clear()
        self.current_result = None

    def _form_to_meta(self) -> BookMetadata:
        base = self.current_meta or BookMetadata()
        authors = [a.strip() for a in self.author_edit.text().split(",") if a.strip()]
        series_index_text = self.series_index_edit.text().strip()
        series_index = None
        if series_index_text:
            try:
                series_index = float(series_index_text)
            except ValueError:
                series_index = None
        return dataclass_replace(
            base,
            title=self.title_edit.text(),
            authors=authors,
            publisher=self.publisher_edit.text(),
            published=self.published_edit.text(),
            isbn=self.isbn_edit.text(),
            language=self.language_edit.text(),
            series=self.series_edit.text(),
            series_index=series_index,
            description=self.description_edit.toPlainText(),
            cover=self.current_cover,
            cover_mime=self.current_cover_mime,
        )

    def _update_cover_preview(self) -> None:
        if self.current_cover:
            pixmap = QPixmap()
            pixmap.loadFromData(self.current_cover)
            self.cover_label.setPixmap(
                pixmap.scaledToHeight(200, Qt.TransformationMode.SmoothTransformation)
            )
        else:
            self.cover_label.setPixmap(QPixmap())
            self.cover_label.setText("Kein Cover")

    # --- Bearbeiten-Tab: Anreichern/Vorschläge -----------------------------

    def _on_enrich_clicked(self) -> None:
        if not self.current_path:
            return
        path = self.current_path
        worker = Worker(lambda: enrich.enrich_file(path, use_llm=True))
        worker.signals.finished.connect(self._on_enrich_finished)
        worker.signals.error.connect(self._on_worker_error)
        self._start_worker(worker)

    def _on_enrich_finished(self, result: enrich.EnrichmentResult) -> None:
        self._populate_form(result.original)
        self.current_result = result
        self._populate_suggestions(result.suggestions)
        self._populate_cover_candidates(result.cover_candidates())
        if result.suggestions:
            self.status_bar.showMessage(f"{len(result.suggestions)} Vorschläge gefunden.")
        else:
            self.status_bar.showMessage("Keine Vorschläge gefunden.")

    def _populate_suggestions(
        self, suggestions: list[BookMetadata], ai_prefix_count: int = 0
    ) -> None:
        self.suggestion_combo.clear()
        self._ai_ids.clear()
        for i, suggestion in enumerate(suggestions):
            label = f"{suggestion.title} - {suggestion.author_str}"
            if i < ai_prefix_count:
                label = f"🤖 KI: {label}"
                self._ai_ids.add(i)
            self.suggestion_combo.addItem(label, suggestion)

    def _populate_cover_candidates(self, candidates: list[enrich.CoverCandidate]) -> None:
        self.cover_combo.clear()
        for candidate in candidates:
            self.cover_combo.addItem(candidate.label, candidate)

    def _on_suggestion_changed(self, index: int) -> None:
        if index < 0 or self.current_result is None:
            return
        suggestion = self.suggestion_combo.itemData(index)
        if suggestion is None:
            return
        merged = self.current_result.original.merged_with(suggestion, prefer_other=True)
        self._fill_form_fields(merged)

    def _on_cover_candidate_changed(self, index: int) -> None:
        if index < 0:
            return
        candidate = self.cover_combo.itemData(index)
        if candidate is None:
            return
        self.current_cover = candidate.data
        self.current_cover_mime = candidate.mime
        self._update_cover_preview()

    def _on_ai_query_clicked(self) -> None:
        if not llm.available():
            QMessageBox.information(
                self,
                "KI nicht verfügbar",
                "Für die KI-Recherche werden ANTHROPIC_API_KEY sowie das Paket "
                "'anthropic' benötigt.",
            )
            return
        known = self._form_to_meta()
        worker = Worker(lambda: llm.research_metadata(known))
        worker.signals.finished.connect(self._on_ai_query_finished)
        worker.signals.error.connect(self._on_worker_error)
        self._start_worker(worker)

    def _on_ai_query_finished(self, data: dict | None) -> None:
        if not data:
            self.status_bar.showMessage("KI konnte das Buch nicht identifizieren.")
            return
        suggestion = BookMetadata(
            title=data.get("title") or "",
            authors=list(data.get("authors") or []),
            publisher=data.get("publisher") or "",
            published=data.get("published") or "",
            isbn=data.get("isbn") or "",
            language=data.get("language") or "",
            description=data.get("description") or "",
            subjects=list(data.get("subjects") or []),
            series=data.get("series") or "",
            series_index=data.get("series_index"),
        )
        existing = [
            self.suggestion_combo.itemData(i) for i in range(self.suggestion_combo.count())
        ]
        all_suggestions = [suggestion, *existing]
        original = self.current_result.original if self.current_result else (
            self.current_meta or BookMetadata()
        )
        self.current_result = enrich.EnrichmentResult(
            original=original, suggestions=all_suggestions, used_llm=True
        )
        self._populate_suggestions(all_suggestions, ai_prefix_count=1)
        self.status_bar.showMessage("KI-Vorschlag hinzugefügt.")

        if suggestion.isbn:
            isbn = suggestion.isbn
            cover_worker = Worker(lambda: providers.search_by_isbn(isbn))
            cover_worker.signals.finished.connect(self._on_ai_cover_search_finished)
            self._start_worker(cover_worker)

    def _on_ai_cover_search_finished(self, results: list[BookMetadata]) -> None:
        for result in results:
            if result.has_cover():
                candidate = enrich.CoverCandidate("🤖 KI-Cover", result.cover, result.cover_mime)
                self.cover_combo.addItem("🤖 KI-Cover", candidate)
                break

    def _on_compare_clicked(self) -> None:
        if self.current_result is None or not self.current_result.suggestions:
            QMessageBox.information(self, "Vergleichen", "Es liegen noch keine Vorschläge vor.")
            return
        dialog = CompareDialog(self.current_result.original, self.current_result.suggestions, self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            self._fill_form_fields(dialog.result_metadata())

    # --- Bearbeiten-Tab: Cover ---------------------------------------------

    def _on_cover_replace_clicked(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self, "Cover auswählen", "", "Bilder (*.jpg *.jpeg *.png)"
        )
        if not path:
            return
        self.current_cover = Path(path).read_bytes()
        self.current_cover_mime = (
            "image/jpeg" if path.lower().endswith((".jpg", ".jpeg")) else "image/png"
        )
        self._update_cover_preview()

    def _on_rotate_clicked(self, degrees: float) -> None:
        if not self.current_cover:
            return
        self.current_cover = covers.rotate(self.current_cover, degrees)
        self._update_cover_preview()

    def _on_crop_clicked(self) -> None:
        if not self.current_cover:
            return
        dialog = CropDialog(self.current_cover, self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            self.current_cover = dialog.cropped_data()
            self._update_cover_preview()

    # --- Bearbeiten-Tab: Speichern/Senden -----------------------------------

    def _maybe_run_ai_check(self, meta: BookMetadata) -> bool:
        if not self.ai_check_checkbox.isChecked() or not llm.available():
            return True
        report = llm.review_metadata(meta)
        if report is None or report.ok:
            return True
        dialog = QualityDialog(report, self)
        return dialog.exec() == QDialog.DialogCode.Accepted

    def _on_save_clicked(self) -> None:
        if not self.current_path:
            return
        meta = self._form_to_meta()
        if not self._maybe_run_ai_check(meta):
            self.status_bar.showMessage("Speichern abgebrochen (KI-Qualitätsprüfung).")
            return

        optimize = self.optimize_cover_checkbox.isChecked()
        make_backup = self.backup_checkbox.isChecked()
        worker = Worker(
            lambda: write_metadata(meta, optimize_cover=optimize, backup=make_backup)
        )
        worker.signals.finished.connect(lambda out_path: self._on_save_finished(meta, out_path))
        worker.signals.error.connect(self._on_worker_error)
        self._start_worker(worker)

    def _on_save_finished(self, meta: BookMetadata, out_path: str) -> None:
        try:
            with library.Library() as lib:
                lib.upsert(
                    dataclass_replace(meta, source_path=out_path), status=library.STATUS_WRITTEN
                )
        except Exception:  # noqa: BLE001 - Bibliotheks-Vermerk ist ein Nice-to-have
            pass
        self.status_bar.showMessage(f"Gespeichert: {out_path}")
        self._load_file(out_path)
        self._refresh_library_list()

    def _on_send_clicked(self) -> None:
        if not self.current_path:
            return
        from kindle_meta.config import Settings

        default_addr = str(Settings().get("kindle_addr", "") or "")
        address, ok = QInputDialog.getText(
            self, "An Kindle senden", "Kindle-E-Mail-Adresse:", text=default_addr
        )
        if not ok or not address:
            return
        path = self.current_path
        worker = Worker(lambda: sendmail.send_to_kindle(path, address))
        worker.signals.finished.connect(lambda _: self._on_send_finished(path))
        worker.signals.error.connect(self._on_worker_error)
        self._start_worker(worker)

    def _on_send_finished(self, path: str) -> None:
        self.status_bar.showMessage(f"Gesendet: {path}")
        try:
            with library.Library() as lib:
                if lib.get(path) is not None:
                    lib.set_status(path, library.STATUS_SENT)
                else:
                    lib.upsert(BookMetadata(source_path=path), status=library.STATUS_SENT)
        except Exception:  # noqa: BLE001
            pass

    def _on_worker_error(self, message: str) -> None:
        QMessageBox.critical(self, "Fehler", message)

    # --- Bearbeiten-Tab: Stapelverarbeitung ---------------------------------

    def _on_settings_clicked(self) -> None:
        from kindle_meta.config import Settings

        dialog = SettingsDialog(Settings(), self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            dialog.save()

    def _on_batch_start_clicked(self) -> None:
        if not self.files:
            return
        protect = profile.load_protected()
        self.batch_progress.setMaximum(len(self.files))
        self.batch_progress.setValue(0)
        self._batch_worker = BatchWorker(
            list(self.files),
            apply=True,
            use_llm=True,
            optimize_cover=self.optimize_cover_checkbox.isChecked(),
            backup=self.backup_checkbox.isChecked(),
            protect=protect,
        )
        self._batch_worker.signals.progress.connect(self._on_batch_progress)
        self._batch_worker.signals.finished.connect(self._on_batch_finished)
        self._batch_worker.signals.error.connect(self._on_worker_error)
        self.thread_pool.start(self._batch_worker)

    def _on_batch_cancel_clicked(self) -> None:
        if self._batch_worker is not None:
            self._batch_worker.cancel()

    def _on_batch_progress(
        self, index: int, total: int, path: str, outcome: enrich.BatchOutcome
    ) -> None:
        self.batch_progress.setValue(index + 1)
        self.status_bar.showMessage(f"{index + 1}/{total}: {path}")

    def _on_batch_finished(self, outcomes: list[enrich.BatchOutcome]) -> None:
        written = 0
        errors = 0
        for outcome in outcomes:
            if outcome.error:
                errors += 1
                continue
            if outcome.written_to and outcome.result is not None:
                written += 1
                try:
                    with library.Library() as lib:
                        lib.upsert(
                            dataclass_replace(
                                outcome.result.original, source_path=outcome.written_to
                            ),
                            status=library.STATUS_WRITTEN,
                        )
                except Exception:  # noqa: BLE001
                    pass
        self.status_bar.showMessage(f"Stapel fertig: {written} geschrieben, {errors} Fehler.")
        self._refresh_library_list()

    # --- Bibliothek-Tab -----------------------------------------------------

    def _refresh_library_list(self, books: list[BookMetadata] | None = None) -> None:
        self.library_list.clear()
        with library.Library() as lib:
            entries = books if books is not None else lib.all()
            for book in entries:
                item = QListWidgetItem(book.title or Path(book.source_path).name)
                thumbnail = lib.get_thumbnail(book.source_path)
                if thumbnail:
                    pixmap = QPixmap()
                    pixmap.loadFromData(thumbnail)
                    item.setIcon(QIcon(pixmap))
                item.setData(Qt.ItemDataRole.UserRole, book.source_path)
                self.library_list.addItem(item)

    def _on_library_search_clicked(self) -> None:
        query = self.library_search_edit.text().strip()
        with library.Library() as lib:
            if query:
                query_filter = library.build_filter_from_query(query)
                books = lib.search(query_filter)
            else:
                books = lib.all()
        self._refresh_library_list(books)

    def _on_library_item_double_clicked(self, item: QListWidgetItem) -> None:
        path = item.data(Qt.ItemDataRole.UserRole)
        if not path:
            return
        self.tabs.setCurrentIndex(0)
        self.add_files([path])
        self.file_list.setCurrentRow(self.files.index(path))
        self._load_file(path)

    def _on_find_duplicates_clicked(self) -> None:
        groups = duplicates.find_duplicate_groups()
        dialog = DuplicatesDialog(groups, self)
        dialog.remove_button.clicked.connect(lambda: self._on_remove_duplicates(dialog))
        dialog.exec()

    def _on_remove_duplicates(self, dialog: DuplicatesDialog) -> None:
        selected = dialog.selected_books()
        if not selected:
            return
        confirm = QMessageBox.question(
            self, "Duplikate entfernen", f"{len(selected)} Datei(en) wirklich löschen?"
        )
        if confirm != QMessageBox.StandardButton.Yes:
            return
        for book in selected:
            try:
                Path(book.source_path).unlink(missing_ok=True)
            except OSError:
                pass
            try:
                with library.Library() as lib:
                    lib.remove(book.source_path)
            except Exception:  # noqa: BLE001
                pass
        dialog.accept()
        self._refresh_library_list()

    def _on_check_series_clicked(self) -> None:
        issues = series.check_series_consistency()
        dialog = SeriesCheckDialog(issues, self)
        dialog.exec()


def main() -> int:
    app = QApplication.instance() or QApplication(sys.argv)
    window = MainWindow()
    window.resize(1100, 700)
    window.show()
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
