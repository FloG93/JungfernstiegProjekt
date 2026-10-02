// Editor: Wellenform + Trim, Berechnung, Notenanzeige, Player (A/B/C), Parameter, Export.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, audioUrl, SAMPLES_BASE_URL } from "../api/client";
import { isFinal, watchJob } from "../api/jobs";
import type {
  DeepPartial,
  Job,
  NotationParams,
  ProjectChanges,
  ProjectPayload,
  ScoreData,
  Trim,
  Waveform,
} from "../api/types";
import { ExportPanel } from "../components/ExportPanel";
import { ParamsPanel } from "../components/ParamsPanel";
import { PipelinePanel } from "../components/PipelinePanel";
import { PlayerBar } from "../components/PlayerBar";
import { ScoreView } from "../components/ScoreView";
import { WaveformEditor, type WaveformHandle } from "../components/WaveformEditor";
import { useDebouncedCallback, useHotkeys } from "../lib/hooks";
import { Player, type Source } from "../lib/player";
import { TimeMap } from "../lib/timing";

function mergeDeep<T extends object>(base: DeepPartial<T>, extra: DeepPartial<T>): DeepPartial<T> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const current = out[key];
    out[key] = value && typeof value === "object" && !Array.isArray(value) && current && typeof current === "object"
      ? mergeDeep(current as object, value as object)
      : value;
  }
  return out as DeepPartial<T>;
}

export function EditorPage({ projectId, onBack }: { projectId: string; onBack(): void }) {
  const [payload, setPayload] = useState<ProjectPayload | null>(null);
  const [waveform, setWaveform] = useState<Waveform | null>(null);
  const [score, setScore] = useState<ScoreData | null>(null);
  const [musicxml, setMusicxml] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [trimDraft, setTrimDraft] = useState<Trim | null>(null);
  const [downbeatDraft, setDownbeatDraft] = useState<number | null | undefined>(undefined);

  const player = useRef<Player | null>(null);
  const waveformRef = useRef<WaveformHandle>(null);
  const [scoreVersion, setScoreVersion] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [source, setSource] = useState<Source>("original");
  const [volume, setVolume] = useState(0);

  const manifest = payload?.manifest;
  const running = job !== null && !isFinal(job);

  // ---- Laden -------------------------------------------------------------------------------
  const loadScore = useCallback(async () => {
    try {
      const [data, xml] = await Promise.all([api.scoreData(projectId), api.musicxml(projectId)]);
      setScore(data);
      setMusicxml(xml);
      setScoreVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Noten konnten nicht geladen werden.");
    }
  }, [projectId]);

  const reload = useCallback(async () => {
    const data = await api.project(projectId);
    setPayload(data);
    if (data.has_score) await loadScore();
    else {
      setScore(null);
      setMusicxml(null);
    }
    return data;
  }, [projectId, loadScore]);

  const followJob = useCallback((initial: Job) => {
    return watchJob(initial, (update) => {
      setJob(update);
      if (update.status === "done") void reload();
      if (update.status === "cancelled" || update.status === "error") void api.project(projectId).then(setPayload);
    });
  }, [projectId, reload]);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    const fail = (e: Error) => !cancelled && setError(e.message);
    api.project(projectId)
      .then((data) => {
        if (cancelled) return;
        setPayload(data);
        if (data.has_score) void loadScore();
      })
      .catch(fail);
    api.waveform(projectId).then((wave) => !cancelled && setWaveform(wave)).catch(fail);
    api.jobs()
      .then((jobs) => {
        const active = jobs.find((j) => j.project_id === projectId && !isFinal(j));
        if (active && !cancelled) stop = followJob(active);
      })
      .catch(fail);
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [projectId, loadScore, followJob]);

  // ---- Player --------------------------------------------------------------------------------
  const trimVersion = manifest?.stages.trim.hash ?? "";
  const pianoVersion = manifest?.stages.separate.hash ?? "";
  const trimDone = manifest?.stages.trim.done ?? false;
  const duration = manifest && manifest.trim
    ? manifest.trim.end_s - manifest.trim.start_s
    : manifest?.source.duration_s ?? 0;

  const hasPiano = payload?.has_piano ?? false;
  const playerKey = trimDone ? `${trimVersion}|${pianoVersion}|${hasPiano}|${scoreVersion}` : null;
  const playerReady = playerKey !== null && loadedKey === playerKey;
  const playerLoading = playerKey !== null && loadedKey !== playerKey;

  useEffect(() => {
    if (playerKey === null) return;
    const instance = player.current ?? new Player();
    player.current = instance;
    instance.onEnded = () => {
      instance.pause();
      setPlaying(false);
    };
    let cancelled = false;
    instance.load({
      originalUrl: audioUrl(projectId, "trimmed", trimVersion),
      pianoUrl: hasPiano ? audioUrl(projectId, "piano", pianoVersion) : null,
      score,
      samplesBaseUrl: SAMPLES_BASE_URL,
      duration,
    }).then(() => {
      if (cancelled) return;
      setLoadedKey(playerKey);
      setPlaying(false);
      setPosition(0);
    }).catch(() => !cancelled && setError("Audio konnte nicht geladen werden."));
    return () => {
      cancelled = true;
    };
  }, [playerKey, projectId, trimVersion, pianoVersion, hasPiano, score, duration]);

  useEffect(() => () => player.current?.dispose(), []);

  useEffect(() => {
    player.current?.setSource(source);
  }, [source, playerReady]);

  useEffect(() => {
    player.current?.setVolume(volume);
  }, [volume, playerReady]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      if (player.current) setPosition(player.current.position);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const togglePlay = useCallback(async () => {
    const instance = player.current;
    if (!instance || !playerReady) return;
    if (instance.playing) {
      instance.pause();
      setPlaying(false);
    } else {
      waveformRef.current?.pause();
      await instance.play();
      setPlaying(true);
    }
  }, [playerReady]);

  const seek = useCallback((seconds: number) => {
    player.current?.seek(seconds);
    setPosition(seconds);
  }, []);

  const timeMap = useMemo(() => (score ? new TimeMap(score.beats) : null), [score]);
  const currentQ = timeMap && !timeMap.empty && (playing || position > 0) ? timeMap.timeToQ(position) : null;

  // ---- Änderungen ----------------------------------------------------------------------------
  const applyChanges = useCallback(async (changes: ProjectChanges, renotate: boolean) => {
    setSaving(true);
    setError(null);
    try {
      let data = await api.patchProject(projectId, changes);
      setPayload(data);
      if (renotate && data.pending.length === 1 && data.pending[0] === "notate") {
        const result = await api.run(projectId);
        setJob(result);
        if (result.status === "done") {
          data = await api.project(projectId);
          setPayload(data);
          await loadScore();
        } else if (result.status === "error" && result.error) {
          setError(`${result.error.message} ${result.error.hint}`);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Änderung fehlgeschlagen.");
      void api.project(projectId).then(setPayload);
    } finally {
      setSaving(false);
    }
  }, [projectId, loadScore]);

  const saveTrim = useDebouncedCallback((trim: Trim) => {
    void applyChanges({ trim }, false).then(() => setTrimDraft(null));
  }, 400);

  const pendingNotation = useRef<DeepPartial<NotationParams>>({});
  const flushNotation = useDebouncedCallback(() => {
    const changes = pendingNotation.current;
    pendingNotation.current = {};
    void applyChanges({ notation: changes }, true).then(() => setDownbeatDraft(undefined));
  }, 500);
  const changeNotation = useCallback((changes: DeepPartial<NotationParams>) => {
    pendingNotation.current = mergeDeep(pendingNotation.current, changes);
    flushNotation();
  }, [flushNotation]);

  const run = async () => {
    setError(null);
    try {
      const started = await api.run(projectId);
      setJob(started);
      followJob(started);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Start fehlgeschlagen.");
    }
  };

  useHotkeys({
    Space: () => void togglePlay(),
    "[": () => waveformRef.current?.setTrimStart(),
    "]": () => waveformRef.current?.setTrimEnd(),
  });

  if (!payload || !manifest) {
    return (
      <main className="editor">
        {error ? <div className="error-box">{error}</div> : <p className="muted">Lade Projekt …</p>}
      </main>
    );
  }

  const trim = trimDraft ?? manifest.trim ?? { start_s: 0, end_s: manifest.source.duration_s };
  const firstDownbeat = downbeatDraft !== undefined ? downbeatDraft : manifest.notation.first_downbeat_s;
  const hasTranscription = manifest.stages.transcribe.done && manifest.stages.rhythm.done;

  return (
    <main className="editor">
      <div className="editor-header">
        <button type="button" className="btn subtle" onClick={onBack}>← Projekte</button>
        <h1 title={manifest.source.original_name}>{manifest.name}</h1>
        <span className="muted">{manifest.source.original_name}</span>
        {saving && <span className="hint">speichert …</span>}
      </div>
      {error && <div className="error-box" role="alert">{error}</div>}
      {waveform && (
        <WaveformEditor ref={waveformRef} url={audioUrl(projectId, "source")} waveform={waveform}
          trim={trim} firstDownbeat={firstDownbeat} disabled={running}
          onTrimChange={(t) => {
            setTrimDraft(t);
            saveTrim(t);
          }}
          onDownbeatChange={(t) => {
            setDownbeatDraft(t);
            changeNotation({ first_downbeat_s: t });
          }}
          onTempoTapped={(bpm) => hasTranscription && changeNotation({ tempo_bpm: bpm })}
          onPlay={() => {
            player.current?.pause();
            setPlaying(false);
          }} />
      )}
      <div className="editor-main">
        <ScoreView musicxml={musicxml} currentQ={currentQ}
          onSeekQ={(q) => timeMap && seek(Math.max(0, timeMap.qToTime(q)))} />
        <aside className="sidebar">
          <PipelinePanel payload={payload} job={job} busy={saving}
            onToggleSeparate={(value) => void applyChanges({ options: { separate: value } }, false)}
            onRun={() => void run()}
            onCancel={() => job && void api.cancelJob(job.id)} />
          <ParamsPanel params={manifest.notation} info={payload.score_info}
            disabled={running || !hasTranscription} onChange={changeNotation} />
          <ExportPanel projectId={projectId} baseName={manifest.notation.title || manifest.name}
            enabled={payload.has_score && !running} musicxml={musicxml} />
        </aside>
      </div>
      <PlayerBar ready={playerReady} loading={playerLoading} playing={playing} position={position}
        duration={duration} source={source} hasPiano={payload.has_piano} hasScore={score !== null}
        volume={volume} onToggle={() => void togglePlay()} onSeek={seek} onSource={setSource}
        onVolume={setVolume} />
    </main>
  );
}
