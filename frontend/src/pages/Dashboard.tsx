import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import { useLibrary } from "../state/LibraryContext";
import * as api from "../lib/api";
import type { DiskUsage } from "../lib/api";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {sub && (
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function formatGB(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export default function Dashboard() {
  const { movies, moviesLoading, shows, showsLoading } = useLibrary();
  const [disk, setDisk] = useState<DiskUsage | null>(null);
  const [diskError, setDiskError] = useState(false);

  useEffect(() => {
    api
      .getDiskUsage()
      .then(setDisk)
      .catch(() => setDiskError(true));
  }, []);

  const loading = moviesLoading || showsLoading;

  const totalSeasons = useMemo(() => shows.reduce((acc, s) => acc + s.seasons.length, 0), [shows]);
  const totalEpisodes = useMemo(
    () => shows.reduce((acc, s) => acc + s.seasons.reduce((a, se) => a + se.episodes.length, 0), 0),
    [shows],
  );

  const recent = useMemo(
    () =>
      [
        ...movies.map((m) => ({ title: m.title, type: "Movie", date: m.dateAdded })),
        ...shows.map((s) => ({ title: s.title, type: "TV Show", date: s.dateAdded })),
      ]
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 8),
    [movies, shows],
  );

  const usedPct = disk ? Math.round((disk.media.usedBytes / disk.media.totalBytes) * 100) : 0;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of your media library" />

      <div className="grid grid-cols-2 gap-4 p-8 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Movies" value={loading ? "—" : movies.length} />
        <StatCard label="TV Shows" value={loading ? "—" : shows.length} />
        <StatCard label="Seasons" value={loading ? "—" : totalSeasons} />
        <StatCard label="Episodes" value={loading ? "—" : totalEpisodes} />
      </div>

      <div className="grid grid-cols-1 gap-4 px-8 pb-8 lg:grid-cols-3">
        <div className="rounded-xl border p-5 lg:col-span-2" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="mb-3 text-sm font-bold">Storage</p>
          {diskError && (
            <p className="text-xs" style={{ color: "var(--text-dim)" }}>
              Couldn't read disk usage.
            </p>
          )}
          {!diskError && !disk && (
            <p className="text-xs" style={{ color: "var(--text-dim)" }}>
              Loading…
            </p>
          )}
          {disk && (
            <>
              <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-alt)" }}>
                <div className="h-full rounded-full" style={{ width: `${usedPct}%`, background: "var(--accent)" }} />
              </div>
              <div className="flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
                <span>{formatGB(disk.media.usedBytes)} used</span>
                <span>{formatGB(disk.media.freeBytes)} available</span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                <div className="rounded-lg p-3" style={{ background: "var(--surface-alt)" }}>
                  <p style={{ color: "var(--text-dim)" }}>Media drive</p>
                  <p className="mt-1 break-all font-mono" style={{ color: "var(--text)" }}>
                    {disk.media.path}
                  </p>
                </div>
                <div className="rounded-lg p-3" style={{ background: "var(--surface-alt)" }}>
                  <p style={{ color: "var(--text-dim)" }}>App drive</p>
                  <p className="mt-1 break-all font-mono" style={{ color: "var(--text)" }}>
                    {disk.appData.path}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <p className="mb-3 text-sm font-bold">Recently Added</p>
          <div className="flex flex-col gap-3">
            {loading && (
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                Loading…
              </p>
            )}
            {!loading && recent.length === 0 && (
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                Nothing added yet.
              </p>
            )}
            {recent.map((r) => (
              <div key={`${r.type}-${r.title}`} className="flex items-center justify-between text-sm">
                <div>
                  <p style={{ color: "var(--text)" }}>{r.title}</p>
                  <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                    {r.type} · {r.date}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
