import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Hls from "hls.js";
import { useLibrary } from "../../state/LibraryContext";
import * as api from "../../lib/api";
import type { Subtitle } from "../../data/types";
import {
  IconArrowLeft,
  IconPlay,
  IconPause,
  IconVolume,
  IconMute,
  IconFullscreen,
  IconExitFullscreen,
  IconSubtitles,
  IconGear,
} from "../../components/Icons";

type Source = "hls" | "direct";

function formatTime(sec: number): string {
  if (!Number.isFinite(sec)) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Player() {
  const { kind, id } = useParams<{ kind: string; id: string }>();
  const navigate = useNavigate();
  const { movies, moviesLoading } = useLibrary();

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimeout = useRef<number | null>(null);
  const resumeAppliedRef = useRef(false);
  const lastSavedPositionRef = useRef(0);

  const [title, setTitle] = useState("");
  const [backTo, setBackTo] = useState("/");
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [infoError, setInfoError] = useState<string | null>(null);

  const [source, setSource] = useState<Source>("direct");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [activeSubtitle, setActiveSubtitle] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<"subtitles" | "settings" | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  const kindPath = kind === "episode" ? "episodes" : "movies";

  useEffect(() => {
    if (!id || !kind) return;
    if (kind === "movie") {
      if (moviesLoading) return;
      const movie = movies.find((m) => m.id === id);
      if (!movie) {
        setInfoError("Movie not found");
        setLoadingInfo(false);
        return;
      }
      setTitle(movie.title);
      setSubtitles(movie.subtitles);
      setBackTo(`/movie/${id}`);
      setInfoError(null);
      setLoadingInfo(false);
    } else {
      setLoadingInfo(true);
      api
        .getEpisodePlaybackInfo(id)
        .then((info) => {
          setTitle(`${info.showTitle} · S${info.seasonNumber}E${info.episode.number}${info.episode.title ? " · " + info.episode.title : ""}`);
          setSubtitles(info.episode.subtitles);
          setBackTo(`/show/${info.showId}`);
          setInfoError(null);
        })
        .catch((err) => setInfoError(err instanceof Error ? err.message : String(err)))
        .finally(() => setLoadingInfo(false));
    }
  }, [kind, id, movies, moviesLoading]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !id || loadingInfo || infoError) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setVideoError(null);

    if (source === "direct") {
      setPreparing(true);
      video.src = `/api/stream/${kindPath}/${id}`;
      return;
    }

    // Compatibility mode: transcodes the whole file to HLS before the playlist is
    // available, so a real full-length title can take a while on first play — give
    // it much longer than hls.js's 10s default before giving up.
    const playlistUrl = `/api/stream/${kindPath}/${id}/hls/playlist.m3u8`;

    if (Hls.isSupported()) {
      setPreparing(true);
      const hls = new Hls({ manifestLoadingTimeOut: 20 * 60 * 1000, manifestLoadingMaxRetry: 0 });
      hlsRef.current = hls;
      hls.loadSource(playlistUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => setPreparing(false));
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setPreparing(false);
          setVideoError(`Playback error: ${data.details}`);
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = playlistUrl;
    } else {
      setVideoError("This browser can't play HLS video. Try Direct Play instead.");
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, kindPath, id, loadingInfo, infoError]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => {
      setPlaying(true);
      api.logEvent("play", {
        movieId: kindPath === "movies" ? id : undefined,
        episodeId: kindPath === "episodes" ? id : undefined,
        positionSec: video.currentTime,
        durationSec: video.duration,
      });
    };
    const onPause = () => {
      setPlaying(false);
      api.logEvent("pause", {
        movieId: kindPath === "movies" ? id : undefined,
        episodeId: kindPath === "episodes" ? id : undefined,
        positionSec: video.currentTime,
        durationSec: video.duration,
      });
    };
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDurationChange = () => setDuration(video.duration || 0);
    const onProgress = () => {
      if (video.buffered.length > 0) setBuffered(video.buffered.end(video.buffered.length - 1));
    };
    const onVolumeChange = () => {
      setVolume(video.volume);
      setMuted(video.muted);
    };
    const onWaiting = () => setPreparing(true);
    const onPlaying = () => setPreparing(false);
    const onCanPlay = () => setPreparing(false);
    const onError = () => {
      // Only the native <video> src (direct play) surfaces errors this way — hls.js
      // reports its own errors separately via Hls.Events.ERROR.
      if (!hlsRef.current) {
        setPreparing(false);
        const code = video.error?.code;
        setVideoError(
          code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
            ? "This file's format isn't supported for direct playback in this browser."
            : "Couldn't load this video."
        );
      }
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("loadedmetadata", onDurationChange);
    video.addEventListener("progress", onProgress);
    video.addEventListener("volumechange", onVolumeChange);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("error", onError);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("loadedmetadata", onDurationChange);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("volumechange", onVolumeChange);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("error", onError);
    };
    // videoRef.current is null while the "Loading…"/error branches render (before
    // the <video> element itself exists), so this must re-run once loadingInfo
    // flips to false — an empty dep array here would attach nothing, forever.
  }, [loadingInfo, infoError]);

  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Reset the "already resumed" guard whenever we switch to a different title.
  useEffect(() => {
    resumeAppliedRef.current = false;
    lastSavedPositionRef.current = 0;
  }, [id]);

  // Once the real duration is known, seek to any saved position — once per title,
  // guarded by the ref rather than a dep so switching Direct Play <-> HLS (which
  // re-fires durationchange) doesn't jump the user back to their resume point.
  useEffect(() => {
    if (resumeAppliedRef.current || !id || !duration || loadingInfo || infoError) return;
    resumeAppliedRef.current = true;
    const fetchProgress = kindPath === "movies" ? api.getMovieProgress(id) : api.getEpisodeProgress(id);
    fetchProgress.then((progress) => {
      const video = videoRef.current;
      if (video && progress && progress.positionSec > 0 && progress.positionSec < duration - 5) {
        video.currentTime = progress.positionSec;
      }
    });
  }, [duration, loadingInfo, infoError, id, kindPath]);

  // Save playback position on a ~10s cadence while playing, on every pause, and
  // as a best-effort on unmount (route change away from the player) — covers the
  // "stop partway through, reopen later, resume near the same spot" flow.
  useEffect(() => {
    if (!id || loadingInfo || infoError) return;

    const saveNow = () => {
      const video = videoRef.current;
      if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
      const position = video.currentTime;
      if (Math.abs(position - lastSavedPositionRef.current) < 1) return;
      lastSavedPositionRef.current = position;
      const save = kindPath === "movies" ? api.saveMovieProgress(id, position, video.duration) : api.saveEpisodeProgress(id, position, video.duration);
      // Fire-and-forget — a dropped save just means resume snaps back a few
      // seconds next time, not worth surfacing to the viewer mid-playback.
      save.catch(() => {});
    };

    const intervalId = window.setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) saveNow();
    }, 10000);
    const video = videoRef.current;
    video?.addEventListener("pause", saveNow);

    return () => {
      window.clearInterval(intervalId);
      video?.removeEventListener("pause", saveNow);
      saveNow();
    };
  }, [id, kindPath, loadingInfo, infoError]);

  const bumpControls = useCallback(() => {
    setShowControls(true);
    if (hideTimeout.current) window.clearTimeout(hideTimeout.current);
    hideTimeout.current = window.setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    if (!playing) {
      if (hideTimeout.current) window.clearTimeout(hideTimeout.current);
      setShowControls(true);
    } else {
      bumpControls();
    }
  }, [playing, bumpControls]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  /** fraction is 0..1 of the way through the video — computed against the video
   * element's own live duration rather than the (possibly stale) React state. */
  const seekToFraction = (fraction: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return;
    v.currentTime = Math.max(0, Math.min(fraction, 1)) * v.duration;
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  };

  const changeVolume = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen();
  };

  // Space/K play-pause, arrows seek/volume, M mute, F fullscreen, Esc exits
  // fullscreen — standard video-player conventions. Reads videoRef/containerRef
  // directly (not the toggle* consts above) so this can register once with an
  // empty dep array instead of re-binding on every render.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      const video = videoRef.current;
      if (!video) return;

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          if (video.paused) video.play().catch(() => {});
          else video.pause();
          break;
        case "ArrowLeft":
        case "j":
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case "ArrowRight":
        case "l":
          e.preventDefault();
          if (Number.isFinite(video.duration)) video.currentTime = Math.min(video.duration, video.currentTime + 10);
          break;
        case "ArrowUp":
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.05);
          video.muted = false;
          break;
        case "ArrowDown":
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.05);
          break;
        case "m":
          video.muted = !video.muted;
          break;
        case "f":
          if (document.fullscreenElement) document.exitFullscreen();
          else containerRef.current?.requestFullscreen();
          break;
        case "Escape":
          if (document.fullscreenElement) document.exitFullscreen();
          break;
        default:
          return;
      }
      bumpControls();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bumpControls]);

  const selectSubtitle = (subId: string | null) => {
    const v = videoRef.current;
    if (v) {
      Array.from(v.textTracks).forEach((track, i) => {
        track.mode = subtitles[i]?.id === subId ? "showing" : "hidden";
      });
    }
    setActiveSubtitle(subId);
    setMenuOpen(null);
  };

  if (loadingInfo) {
    return (
      <div className="grid h-screen place-items-center" style={{ background: "#0a0e17", color: "#9fb0c4" }}>
        Loading…
      </div>
    );
  }

  if (infoError) {
    return (
      <div className="grid h-screen place-items-center gap-3 text-center" style={{ background: "#0a0e17" }}>
        <div>
          <p style={{ color: "#f87171" }}>{infoError}</p>
          <button onClick={() => navigate(-1)} className="mt-3 text-sm" style={{ color: "#60a5fa" }}>
            ← Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-screen w-full overflow-hidden select-none"
      style={{ background: "#0a0e17" }}
      onMouseMove={bumpControls}
    >
      <video ref={videoRef} className="h-full w-full object-contain" onClick={togglePlay} autoPlay playsInline>
        {subtitles.map((s) => (
          <track key={s.id} kind="subtitles" src={s.url} label={s.language} />
        ))}
      </video>

      {preparing && !videoError && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-3 text-sm text-white">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Preparing stream…
          </div>
        </div>
      )}

      {videoError && (
        <div className="absolute inset-0 grid place-items-center px-6 text-center">
          <div>
            <p className="text-sm" style={{ color: "#f87171" }}>
              {videoError}
            </p>
            <button
              onClick={() => setSource(source === "hls" ? "direct" : "hls")}
              className="mt-3 rounded-full px-5 py-2.5 text-sm font-bold"
              style={{ background: "#6366f1", color: "white" }}
            >
              {source === "hls" ? "Try Direct Play instead" : "Try Compatibility Mode instead"}
            </button>
          </div>
        </div>
      )}

      {/* top bar */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-6 transition-opacity duration-300" style={{ opacity: showControls ? 1 : 0 }}>
        <button
          onClick={() => navigate(backTo)}
          aria-label="Back to Browse"
          title="Back to Browse"
          className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/30 text-white/90 backdrop-blur-md transition-colors hover:bg-black/45"
        >
          <IconArrowLeft size={18} />
        </button>

        <div className="hidden max-w-md items-center gap-2 truncate rounded-full border border-white/15 bg-black/30 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-md sm:flex">
          <span>▶</span>
          <span className="truncate">{title}</span>
        </div>

        <div className="h-10 w-10" />
      </div>

      {/* center play button — the wrapper spans the whole screen just to center
          its child, so it must ignore pointer events itself (only the button
          re-enables them) or it silently steals clicks from everything behind
          it, including the top/bottom bars, even while invisible at opacity 0 */}
      {!preparing && !videoError && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-300"
          style={{ opacity: showControls ? 1 : 0 }}
        >
          <button
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
            className="pointer-events-auto grid h-24 w-24 place-items-center rounded-full border border-white/25 bg-white/10 text-3xl text-white backdrop-blur-md transition-transform hover:scale-105"
            style={{ boxShadow: "0 0 60px rgba(99,102,241,0.35)" }}
          >
            {playing ? <IconPause size={30} /> : <IconPlay size={30} />}
          </button>
        </div>
      )}

      {/* settings panel */}
      {menuOpen === "settings" && (
        <div className="absolute bottom-28 right-6 w-72 rounded-2xl border border-white/10 bg-[#11141c]/95 p-2 text-sm text-white/90 shadow-2xl backdrop-blur-md sm:right-10">
          <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40">Playback Mode</p>
          {(
            [
              { key: "direct" as const, label: "Direct Play", hint: "Fastest — no transcode wait" },
              { key: "hls" as const, label: "Compatibility (HLS)", hint: "For unsupported formats" },
            ]
          ).map((opt) => (
            <div
              key={opt.key}
              onClick={() => {
                setSource(opt.key);
                setMenuOpen(null);
              }}
              className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 hover:bg-white/5"
            >
              <div>
                <p>{opt.label}</p>
                <p className="text-xs text-white/50">{opt.hint}</p>
              </div>
              {source === opt.key && <span style={{ color: "#a78bfa" }}>●</span>}
            </div>
          ))}
        </div>
      )}

      {/* subtitles panel */}
      {menuOpen === "subtitles" && (
        <div className="absolute bottom-28 right-6 w-56 rounded-2xl border border-white/10 bg-[#11141c]/95 p-2 text-sm text-white/90 shadow-2xl backdrop-blur-md sm:right-10">
          <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40">Subtitles</p>
          <div onClick={() => selectSubtitle(null)} className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 hover:bg-white/5">
            <span>Off</span>
            {activeSubtitle === null && <span style={{ color: "#a78bfa" }}>●</span>}
          </div>
          {subtitles.map((s) => (
            <div key={s.id} onClick={() => selectSubtitle(s.id)} className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 hover:bg-white/5">
              <span>{s.language}</span>
              {activeSubtitle === s.id && <span style={{ color: "#a78bfa" }}>●</span>}
            </div>
          ))}
        </div>
      )}

      {/* control bar */}
      <div
        className="absolute inset-x-6 bottom-6 rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-md transition-opacity duration-300 sm:inset-x-10 sm:p-5"
        style={{ opacity: showControls ? 1 : 0 }}
      >
        <div className="mb-2 flex items-center gap-3 text-xs text-white/70">
          <span className="tabular-nums">{formatTime(currentTime)}</span>
          <div
            className="group relative h-1.5 flex-1 cursor-pointer rounded-full bg-white/20"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              seekToFraction((e.clientX - rect.left) / rect.width);
            }}
          >
            <div
              className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-white/25"
              style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }}
            />
            <div
              className="pointer-events-none absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%`, background: "linear-gradient(90deg, #6366f1, #a78bfa)" }}
            />
            <div
              className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100"
              style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
          <span className="tabular-nums">{formatTime(duration)}</span>
        </div>

        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-4 text-lg">
            <button onClick={togglePlay} aria-label="Play/pause">
              {playing ? <IconPause size={18} /> : <IconPlay size={18} />}
            </button>
            <button onClick={toggleMute} aria-label="Mute">
              {muted || volume === 0 ? <IconMute size={16} /> : <IconVolume size={16} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              className="w-20"
              style={{ accentColor: "#8b8ff5" }}
            />
          </div>
          <div className="flex items-center gap-4 text-lg">
            {subtitles.length > 0 && (
              <button
                onClick={() => setMenuOpen(menuOpen === "subtitles" ? null : "subtitles")}
                aria-label="Subtitles"
                className="grid h-8 w-8 place-items-center rounded-full text-base transition-colors"
                style={{ background: menuOpen === "subtitles" ? "rgba(99,102,241,0.35)" : "transparent" }}
              >
                <IconSubtitles size={17} />
              </button>
            )}
            <button
              onClick={() => setMenuOpen(menuOpen === "settings" ? null : "settings")}
              aria-label="Playback settings"
              className="grid h-8 w-8 place-items-center rounded-full text-base transition-colors"
              style={{ background: menuOpen === "settings" ? "rgba(99,102,241,0.35)" : "transparent" }}
            >
              <IconGear size={17} />
            </button>
            <button onClick={toggleFullscreen} aria-label="Fullscreen">
              {fullscreen ? <IconExitFullscreen size={17} /> : <IconFullscreen size={17} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
