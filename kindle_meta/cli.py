"""Kommandozeilen-Oberfläche für kindle-meta."""

from __future__ import annotations

import argparse
import sys
from dataclasses import replace as dataclass_replace

from kindle_meta import backup, duplicates, enrich, library, profile, sendmail, series, watch
from kindle_meta.calibre import CalibreNotFound
from kindle_meta.models import BookMetadata
from kindle_meta.readers import UnsupportedFormat, read_metadata
from kindle_meta.sendmail import SendError
from kindle_meta.writers import WriteError

_KNOWN_ERRORS = (
    UnsupportedFormat,
    WriteError,
    backup.BackupError,
    CalibreNotFound,
    SendError,
    OSError,
    ValueError,
    RuntimeError,
)


def _print_error(message: str) -> None:
    print(f"Fehler: {message}", file=sys.stderr)


def _maybe_record(meta_or_path: BookMetadata | str, status: str) -> None:
    """Vermerkt eine geschriebene/gesendete Datei in der Bibliothek.

    Fehler dabei (z. B. kein Schreibzugriff auf `app_home()`) dürfen ein
    ansonsten erfolgreiches CLI-Kommando nicht scheitern lassen.
    """
    try:
        with library.Library() as lib:
            if isinstance(meta_or_path, BookMetadata):
                lib.upsert(meta_or_path, status=status)
            elif lib.get(meta_or_path) is not None:
                lib.set_status(meta_or_path, status)
            else:
                lib.upsert(BookMetadata(source_path=meta_or_path), status=status)
    except Exception:  # noqa: BLE001 - Bibliotheks-Vermerk ist ein Nice-to-have
        pass


def _apply_overrides(meta: BookMetadata, args: argparse.Namespace) -> BookMetadata:
    updates: dict[str, object] = {}
    if args.title:
        updates["title"] = args.title
    if args.author:
        updates["authors"] = [a.strip() for a in args.author.split(",") if a.strip()]
    if args.publisher:
        updates["publisher"] = args.publisher
    if args.date:
        updates["published"] = args.date
    if args.isbn:
        updates["isbn"] = args.isbn
    if args.series:
        updates["series"] = args.series
    if args.series_index is not None:
        updates["series_index"] = args.series_index
    return dataclass_replace(meta, **updates) if updates else meta


def _run_ai_check(meta: BookMetadata, *, strict: bool) -> bool:
    """Führt die KI-Qualitätsprüfung aus; gibt True zurück, wenn geschrieben
    werden darf (immer True, wenn keine KI verfügbar ist oder alles passt).
    """
    from kindle_meta import llm

    report = llm.review_metadata(meta)
    if report is None or report.ok:
        return True
    for issue in report.issues:
        suffix = f" (Vorschlag: {issue.suggestion})" if issue.suggestion else ""
        print(f"KI-Hinweis [{issue.field}]: {issue.message}{suffix}", file=sys.stderr)
    return not strict


def cmd_info(args: argparse.Namespace) -> int:
    meta = read_metadata(args.path)
    print(f"Titel: {meta.title}")
    print(f"Autor(en): {meta.author_str}")
    print(f"Verlag: {meta.publisher}")
    print(f"Datum: {meta.published}")
    print(f"Sprache: {meta.language}")
    print(f"ISBN: {meta.isbn}")
    if meta.series and meta.series_index is not None:
        print(f"Serie: {meta.series} #{meta.series_index:g}")
    elif meta.series:
        print(f"Serie: {meta.series}")
    else:
        print("Serie: -")
    print(f"Seiten: {meta.page_count}")
    print(f"Cover: {'ja' if meta.has_cover() else 'nein'}")
    return 0


def cmd_enrich(args: argparse.Namespace) -> int:
    result = enrich.enrich_file(args.path, use_llm=not args.no_llm)
    if not result.suggestions:
        print("Keine Vorschläge gefunden.")
        return 0
    for i, suggestion in enumerate(result.suggestions, start=1):
        print(f"{i}. {suggestion.title} - {suggestion.author_str} ({suggestion.publisher})")
    return 0


def cmd_apply(args: argparse.Namespace) -> int:
    result = enrich.enrich_file(args.path, use_llm=True)
    meta = result.best_with() if result.suggestions else read_metadata(args.path)
    meta = _apply_overrides(meta, args)

    if args.ai_check or args.strict_ai_check:
        if not _run_ai_check(meta, strict=args.strict_ai_check):
            _print_error("Abgebrochen - KI-Qualitätsprüfung hat Probleme gefunden.")
            return 1

    out_path = write_metadata_safe(meta, args)
    _maybe_record(dataclass_replace(meta, source_path=out_path), library.STATUS_WRITTEN)
    print(f"Geschrieben: {out_path}")
    return 0


def write_metadata_safe(meta: BookMetadata, args: argparse.Namespace) -> str:
    from kindle_meta.writers import write_metadata

    return write_metadata(
        meta, args.out, optimize_cover=args.optimize_cover, backup=not args.no_backup
    )


def cmd_batch(args: argparse.Namespace) -> int:
    protect = profile.parse_protected(args.protect) if args.protect else None
    outcomes = enrich.enrich_batch(
        args.paths,
        apply=args.apply,
        out_dir=args.out_dir,
        use_llm=not args.no_llm,
        optimize_cover=args.optimize_cover,
        backup=not args.no_backup,
        protect=protect,
    )
    exit_code = 0
    for outcome in outcomes:
        if outcome.error:
            _print_error(f"{outcome.path}: {outcome.error}")
            exit_code = 1
        elif outcome.written_to:
            print(f"Geschrieben: {outcome.written_to}")
            if outcome.result is not None:
                _maybe_record(
                    dataclass_replace(outcome.result.original, source_path=outcome.written_to),
                    library.STATUS_WRITTEN,
                )
        else:
            print(f"Keine Vorschläge: {outcome.path}")
    return exit_code


def cmd_convert(args: argparse.Namespace) -> int:
    from kindle_meta import writers

    out_path = writers.convert_with_calibre(args.path, args.to)
    print(f"Konvertiert: {out_path}")
    return 0


def cmd_send(args: argparse.Namespace) -> int:
    sendmail.send_to_kindle(args.path, args.to)
    _maybe_record(args.path, library.STATUS_SENT)
    print(f"Gesendet an: {args.to}")
    return 0


def cmd_undo(args: argparse.Namespace) -> int:
    restored = backup.restore_latest(args.path)
    print(f"Wiederhergestellt aus: {restored}")
    return 0


def cmd_library(args: argparse.Namespace) -> int:
    with library.Library() as lib:
        if args.query:
            query_filter = library.build_filter_from_query(args.query)
            books = lib.search(query_filter)
        else:
            books = lib.all()

    if not books:
        print("Keine Bücher in der Bibliothek.")
        return 0
    for book in books:
        series_info = ""
        if book.series:
            series_info = (
                f" ({book.series} #{book.series_index:g})"
                if book.series_index is not None
                else f" ({book.series})"
            )
        print(f"{book.title} - {book.author_str}{series_info} [{book.source_path}]")
    return 0


def cmd_watch(args: argparse.Namespace) -> int:
    watcher = watch.FolderWatcher(args.folder)

    def handle(path: str) -> None:
        print(f"Neu erkannt: {path}")
        if args.apply:
            outcomes = enrich.enrich_batch(
                [path], apply=True, out_dir=args.out_dir, use_llm=not args.no_llm
            )
            for outcome in outcomes:
                if outcome.error:
                    _print_error(f"{outcome.path}: {outcome.error}")
                elif outcome.written_to:
                    print(f"Geschrieben: {outcome.written_to}")

    watcher.run(
        handle,
        interval=args.interval,
        iterations=getattr(args, "iterations", None),
        process_existing=args.existing,
    )
    return 0


def cmd_duplicates(args: argparse.Namespace) -> int:
    groups = duplicates.find_duplicate_groups()
    if not groups:
        print("Keine Dubletten gefunden.")
        return 0
    for i, group in enumerate(groups, start=1):
        print(f"Gruppe {i}:")
        for book in group:
            print(f"  - {book.title} [{book.source_path}]")
    return 0


def cmd_series_check(args: argparse.Namespace) -> int:
    issues = series.check_series_consistency()
    if not issues:
        print("Keine Serien-Probleme gefunden.")
        return 0
    for issue in issues:
        print(f"[{issue.series}] {issue.message}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="kindle-meta")
    sub = parser.add_subparsers(dest="command", required=True)

    p_info = sub.add_parser("info", help="Metadaten einer Datei anzeigen")
    p_info.add_argument("path")
    p_info.set_defaults(func=cmd_info)

    p_enrich = sub.add_parser("enrich", help="Metadaten-Vorschläge anzeigen")
    p_enrich.add_argument("path")
    p_enrich.add_argument("--no-llm", action="store_true")
    p_enrich.set_defaults(func=cmd_enrich)

    p_apply = sub.add_parser("apply", help="Metadaten anreichern und schreiben")
    p_apply.add_argument("path")
    p_apply.add_argument("--out")
    p_apply.add_argument("--title")
    p_apply.add_argument("--author")
    p_apply.add_argument("--publisher")
    p_apply.add_argument("--date")
    p_apply.add_argument("--isbn")
    p_apply.add_argument("--series")
    p_apply.add_argument("--series-index", type=float)
    p_apply.add_argument("--optimize-cover", action="store_true")
    p_apply.add_argument("--no-backup", action="store_true")
    p_apply.add_argument("--ai-check", action="store_true", help="KI-Qualitätsprüfung, nur warnen")
    p_apply.add_argument(
        "--strict-ai-check", action="store_true", help="Bei KI-Warnungen nicht schreiben"
    )
    p_apply.set_defaults(func=cmd_apply)

    p_batch = sub.add_parser("batch", help="Mehrere Dateien anreichern")
    p_batch.add_argument("paths", nargs="+")
    p_batch.add_argument("--apply", action="store_true")
    p_batch.add_argument("--out-dir")
    p_batch.add_argument("--no-llm", action="store_true")
    p_batch.add_argument("--optimize-cover", action="store_true")
    p_batch.add_argument("--no-backup", action="store_true")
    p_batch.add_argument("--protect")
    p_batch.set_defaults(func=cmd_batch)

    p_convert = sub.add_parser("convert", help="Mit Calibre konvertieren")
    p_convert.add_argument("path")
    p_convert.add_argument("--to", default="azw3")
    p_convert.set_defaults(func=cmd_convert)

    p_send = sub.add_parser("send", help="Per E-Mail an den Kindle senden")
    p_send.add_argument("path")
    p_send.add_argument("--to", required=True)
    p_send.set_defaults(func=cmd_send)

    p_undo = sub.add_parser("undo", help="Letztes Backup wiederherstellen")
    p_undo.add_argument("path")
    p_undo.set_defaults(func=cmd_undo)

    p_library = sub.add_parser("library", help="Bibliothek anzeigen/durchsuchen")
    p_library.add_argument("--query", help="Auch natürlichsprachig, z. B. 'Bücher ohne Cover'")
    p_library.set_defaults(func=cmd_library)

    p_watch = sub.add_parser("watch", help="Ordner auf neue Dateien überwachen")
    p_watch.add_argument("folder")
    p_watch.add_argument("--apply", action="store_true")
    p_watch.add_argument("--out-dir")
    p_watch.add_argument("--no-llm", action="store_true")
    p_watch.add_argument("--interval", type=float, default=5.0)
    p_watch.add_argument("--existing", action="store_true")
    p_watch.set_defaults(func=cmd_watch)

    p_duplicates = sub.add_parser("duplicates", help="Dubletten in der Bibliothek finden")
    p_duplicates.set_defaults(func=cmd_duplicates)

    p_series_check = sub.add_parser("series-check", help="Serien-Konsistenz prüfen")
    p_series_check.set_defaults(func=cmd_series_check)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except _KNOWN_ERRORS as exc:
        _print_error(str(exc))
        return 1


if __name__ == "__main__":
    sys.exit(main())
