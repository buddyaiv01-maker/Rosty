import { createContext, useContext, useEffect, useState } from "react";
import * as api from "../lib/api";
import type { Movie, TVShow } from "../data/types";

type LibraryContextValue = {
  movies: Movie[];
  moviesLoading: boolean;
  moviesError: string | null;
  refreshMovies: () => Promise<void>;
  saveMovie: (
    m: Movie,
    files: { poster?: File; backdrop?: File; video?: File; subtitles: { language: string; file: File }[] },
  ) => Promise<void>;
  deleteMovie: (id: string) => Promise<void>;

  shows: TVShow[];
  showsLoading: boolean;
  showsError: string | null;
  refreshShows: () => Promise<void>;
  saveShow: (s: TVShow, files: { poster?: File; backdrop?: File }) => Promise<void>;
  deleteShow: (id: string) => Promise<void>;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

// Every step below is a separate network call, and a generic "Failed to
// fetch" gives no clue which one actually failed — this tags the error with
// which step it came from so it's diagnosable from the message alone.
async function withStep<T>(step: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`${step}: ${msg}`);
  }
}

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [moviesLoading, setMoviesLoading] = useState(true);
  const [moviesError, setMoviesError] = useState<string | null>(null);

  const [shows, setShows] = useState<TVShow[]>([]);
  const [showsLoading, setShowsLoading] = useState(true);
  const [showsError, setShowsError] = useState<string | null>(null);

  const refreshMovies = async () => {
    setMoviesLoading(true);
    try {
      setMovies(await api.listMovies());
      setMoviesError(null);
    } catch (err) {
      setMoviesError(err instanceof Error ? err.message : String(err));
    } finally {
      setMoviesLoading(false);
    }
  };

  const refreshShows = async () => {
    setShowsLoading(true);
    try {
      setShows(await api.listShows());
      setShowsError(null);
    } catch (err) {
      setShowsError(err instanceof Error ? err.message : String(err));
    } finally {
      setShowsLoading(false);
    }
  };

  useEffect(() => {
    refreshMovies();
    refreshShows();
  }, []);

  const saveMovie: LibraryContextValue["saveMovie"] = async (m, files) => {
    const isNew = !movies.some((x) => x.id === m.id);
    let saved = await withStep("Saving movie details", () => (isNew ? api.createMovie(m) : api.updateMovie(m.id, m)));
    if (files.poster) saved = await withStep("Uploading poster", () => api.uploadMoviePoster(saved.id, files.poster!));
    if (files.backdrop) saved = await withStep("Uploading backdrop", () => api.uploadMovieBackdrop(saved.id, files.backdrop!));
    if (files.video) saved = await withStep("Uploading video", () => api.uploadMovieVideo(saved.id, files.video!));
    for (const sub of files.subtitles) {
      await withStep(`Uploading ${sub.language} subtitle`, () => api.uploadMovieSubtitle(saved.id, sub.language, sub.file));
    }
    await refreshMovies();
  };

  const deleteMovieById = async (id: string) => {
    await api.deleteMovie(id);
    await refreshMovies();
  };

  const saveShow: LibraryContextValue["saveShow"] = async (s, files) => {
    const isNew = !shows.some((x) => x.id === s.id);
    let saved = await withStep("Saving show details", () => (isNew ? api.createShow(s) : api.updateShow(s.id, s)));
    if (files.poster) saved = await withStep("Uploading poster", () => api.uploadShowPoster(saved.id, files.poster!));
    if (files.backdrop) saved = await withStep("Uploading backdrop", () => api.uploadShowBackdrop(saved.id, files.backdrop!));
    await refreshShows();
  };

  const deleteShowById = async (id: string) => {
    await api.deleteShow(id);
    await refreshShows();
  };

  return (
    <LibraryContext.Provider
      value={{
        movies,
        moviesLoading,
        moviesError,
        refreshMovies,
        saveMovie,
        deleteMovie: deleteMovieById,
        shows,
        showsLoading,
        showsError,
        refreshShows,
        saveShow,
        deleteShow: deleteShowById,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}
