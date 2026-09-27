"""Kommandozeile: Pipeline ohne Oberfläche, Modellverwaltung, Server und App-Start.

Beispiele::

    pianoscribe run song.mp3 --start 42.1 --end 71.8 [--no-separate]
    pianoscribe run --project <id> --notate-only --grid 1/8 --split fixed
    pianoscribe models download
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from . import __version__
from . import project as projects
from .project import STAGES


def _add_notation_args(p: argparse.ArgumentParser) -> None:
    g = p.add_argument_group("Notation")
    g.add_argument("--tempo", type=float, help="Tempo in BPM (Standard: automatisch)")
    g.add_argument("--auto-tempo", action="store_true", help="manuelles Tempo zurücksetzen")
    g.add_argument("--time-signature", help="Taktart, z. B. 4/4, 3/4, 6/8")
    g.add_argument("--key", help="Tonart, z. B. 'E- major' (Standard: automatisch)")
    g.add_argument("--auto-key", action="store_true", help="manuelle Tonart zurücksetzen")
    g.add_argument("--grid", choices=["auto", "1/8", "1/16", "1/16+triplets"])
    g.add_argument("--split", choices=["auto", "fixed"], help="Händetrennung")
    g.add_argument("--split-pitch", type=int, help="Split-Tonhöhe (MIDI, 60 = C4)")
    g.add_argument("--min-note-ms", type=int)
    g.add_argument("--min-velocity", type=int)
    g.add_argument("--transpose", type=int, help="Halbtöne")
    g.add_argument("--first-downbeat", type=float,
                   help="erster Taktschlag in s (bezogen auf die Originaldatei)")
    g.add_argument("--no-pedal", action="store_true", help="keine Pedalzeichen")
    g.add_argument("--title")
    g.add_argument("--composer")


def _notation_changes(args: argparse.Namespace) -> dict[str, Any]:
    changes: dict[str, Any] = {}
    if args.tempo is not None:
        changes["tempo_bpm"] = args.tempo
    if args.auto_tempo:
        changes["tempo_bpm"] = None
    if args.time_signature:
        changes["time_signature"] = args.time_signature
    if args.key:
        changes["key"] = args.key
    if args.auto_key:
        changes["key"] = None
    if args.grid:
        changes["grid"] = args.grid
    split: dict[str, Any] = {}
    if args.split:
        split["mode"] = args.split
    if args.split_pitch is not None:
        split["pitch"] = args.split_pitch
    if split:
        changes["hand_split"] = split
    for attr, key in (("min_note_ms", "min_note_ms"), ("min_velocity", "min_velocity"),
                      ("transpose", "transpose"), ("first_downbeat", "first_downbeat_s"),
                      ("title", "title"), ("composer", "composer")):
        value = getattr(args, attr)
        if value is not None:
            changes[key] = value
    if args.no_pedal:
        changes["pedal"] = False
    return changes


def _progress_printer(quiet: bool) -> Any:
    from .pipeline import STAGE_TITLES, StageEvent

    last: dict[str, int] = {}

    def on_event(ev: StageEvent) -> None:
        if quiet:
            return
        title = STAGE_TITLES[ev.stage]
        if ev.status == "progress":
            pct = int(ev.progress * 100)
            if pct // 10 != last.get(ev.stage, -1) // 10:
                last[ev.stage] = pct
                print(f"  {title}: {pct:3d} %", flush=True)
        elif ev.status == "start":
            print(f"▶ {title}", flush=True)
        elif ev.status == "done":
            print(f"✔ {title}", flush=True)
        elif ev.status == "cached":
            print(f"· {title} (unverändert)", flush=True)
        elif ev.status == "skipped":
            print(f"· {title} (übersprungen)", flush=True)

    return on_event


def cmd_run(args: argparse.Namespace) -> int:
    from .pipeline import ModelEngines, Pipeline

    if args.project:
        project = projects.get(args.project)
    elif args.file:
        print(f"Importiere {args.file} …", flush=True)
        project = projects.create(Path(args.file), name=args.name)
    else:
        print("Bitte eine Audiodatei oder --project angeben.", file=sys.stderr)
        return 2

    changes: dict[str, Any] = {}
    if args.start is not None or args.end is not None:
        m = project.load()
        start, end = m.trim_range()
        changes["trim"] = {"start_s": args.start if args.start is not None else start,
                           "end_s": args.end if args.end is not None else end}
    if args.no_separate:
        changes["options"] = {"separate": False}
    elif args.separate:
        changes["options"] = {"separate": True}
    notation = _notation_changes(args)
    if notation:
        changes["notation"] = notation
    if args.name and args.project:
        changes["name"] = args.name
    if changes:
        project.update(changes)

    only = ["notate"] if args.notate_only else (args.only.split(",") if args.only else None)
    pipeline = Pipeline(ModelEngines(args.device), on_event=_progress_printer(args.quiet),
                        log=lambda msg: print(f"  ! {msg}", flush=True))
    pipeline.run(project, from_stage=args.from_stage, only=only)

    info_path = project.score_json
    if info_path.exists():
        info = json.loads(info_path.read_text(encoding="utf-8"))["info"]
        print(f"\nProjekt {project.id}: {project.root}")
        print(f"  Tempo {info['tempo_bpm']} BPM ({info['tempo_source']}), Takt "
              f"{info['time_signature']}, Tonart {info['key_name']} ({info['key_source']}), "
              f"{info['measures']} Takte, Auftakt {info['pickup_quarters']} Viertel, "
              f"{info['notes']} Noten")
        for warning in info.get("warnings", []):
            print(f"  Hinweis: {warning}")
        for path in (project.score_musicxml, project.score_mid, project.raw_mid):
            print(f"  {path}")
    if args.timings and pipeline.timings:
        print("\nLaufzeiten:")
        for stage, t in pipeline.timings.items():
            vram = f", VRAM-Spitze {t['vram_peak_mb']:.0f} MiB" if t["vram_peak_mb"] else ""
            print(f"  {stage:10s} {t['seconds']:7.2f} s{vram}")
    return 0


def cmd_projects(_args: argparse.Namespace) -> int:
    for m in projects.list_projects():
        start, end = m.trim_range()
        print(f"{m.id}  {m.created}  {m.name}  [{start:.1f}–{end:.1f} s]")
    return 0


def cmd_show(args: argparse.Namespace) -> int:
    print(projects.get(args.id).load().model_dump_json(indent=2))
    return 0


def cmd_delete(args: argparse.Namespace) -> int:
    projects.delete(args.id)
    print(f"Projekt {args.id} gelöscht.")
    return 0


def cmd_models(args: argparse.Namespace) -> int:
    from . import models

    if args.action == "download":
        def progress(spec: models.ModelSpec, done: int, total: int) -> None:
            pct = int(done * 100 / max(total, 1))
            if pct % 10 == 0 or done == total:
                print(f"\r  {spec.title}: {pct:3d} %", end="", flush=True)
                if done >= total:
                    print()

        models.download_missing(progress)
    for entry in models.status():
        mark = "✔" if entry["installed"] else "✘"
        print(f"{mark} {entry['title']}  ({int(entry['size']) // 2**20} MB)  {entry['path']}")
    return 0


def cmd_info(_args: argparse.Namespace) -> int:
    from . import models
    from .paths import data_dir
    from .runtime import gpu_info

    print(json.dumps({"version": __version__, "data_dir": str(data_dir()), "gpu": gpu_info(),
                      "models": models.status()}, indent=2, ensure_ascii=False))
    return 0


def cmd_serve(args: argparse.Namespace) -> int:
    from .server import serve

    serve(host=args.host, port=args.port, dev=args.dev)
    return 0


def cmd_app(_args: argparse.Namespace) -> int:
    from .main import run_app

    return run_app()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="pianoscribe", description="PianoScribe – Klavier "
                                     "aus Audio isolieren, transkribieren und notieren.")
    parser.add_argument("--version", action="version", version=__version__)
    sub = parser.add_subparsers(dest="command")

    run = sub.add_parser("run", help="Pipeline für eine Datei oder ein Projekt ausführen")
    run.add_argument("file", nargs="?", help="Audiodatei (legt ein neues Projekt an)")
    run.add_argument("--project", help="vorhandenes Projekt (ID)")
    run.add_argument("--name", help="Projektname")
    run.add_argument("--start", type=float, help="Ausschnitt-Beginn in s")
    run.add_argument("--end", type=float, help="Ausschnitt-Ende in s")
    sep = run.add_mutually_exclusive_group()
    sep.add_argument("--no-separate", action="store_true", help="Separation überspringen")
    sep.add_argument("--separate", action="store_true", help="Separation einschalten")
    run.add_argument("--from-stage", choices=STAGES, help="ab dieser Stufe neu rechnen")
    run.add_argument("--only", help="nur diese Stufen (kommagetrennt)")
    run.add_argument("--notate-only", action="store_true", help="nur die Notationsstufe")
    run.add_argument("--device", choices=["auto", "cuda", "cpu"], default="auto")
    run.add_argument("--timings", action="store_true", help="Laufzeiten und VRAM ausgeben")
    run.add_argument("--quiet", action="store_true")
    _add_notation_args(run)
    run.set_defaults(func=cmd_run)

    sub.add_parser("projects", help="Projekte auflisten").set_defaults(func=cmd_projects)
    show = sub.add_parser("show", help="Manifest eines Projekts anzeigen")
    show.add_argument("id")
    show.set_defaults(func=cmd_show)
    delete = sub.add_parser("delete", help="Projekt löschen")
    delete.add_argument("id")
    delete.set_defaults(func=cmd_delete)

    mdl = sub.add_parser("models", help="Modellgewichte anzeigen oder herunterladen")
    mdl.add_argument("action", choices=["status", "download"], nargs="?", default="status")
    mdl.set_defaults(func=cmd_models)
    sub.add_parser("info", help="GPU- und Modellstatus").set_defaults(func=cmd_info)

    srv = sub.add_parser("serve", help="API-Server starten (für Entwicklung im Browser)")
    srv.add_argument("--host", default="127.0.0.1")
    srv.add_argument("--port", type=int, default=8765)
    srv.add_argument("--dev", action="store_true", help="ohne Token, CORS für Vite")
    srv.set_defaults(func=cmd_serve)
    sub.add_parser("app", help="Desktop-App starten").set_defaults(func=cmd_app)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if not getattr(args, "func", None):
        parser.print_help()
        return 0
    try:
        return int(args.func(args))
    except projects.ProjectNotFoundError as exc:
        print(f"Projekt nicht gefunden: {exc}", file=sys.stderr)
        return 1
    except (projects.ProjectError, ValueError) as exc:
        print(f"Fehler: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        from .models import ModelMissingError
        from .pipeline import PipelineError
        from .runtime import CancelledError

        if isinstance(exc, ModelMissingError | PipelineError | CancelledError):
            print(f"Fehler: {exc}", file=sys.stderr)
            return 1
        raise


if __name__ == "__main__":
    raise SystemExit(main())
