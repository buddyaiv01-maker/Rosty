export type Subtitle = {
  id: string;
  language: string;
  format: "srt" | "vtt";
  fileName: string;
  url?: string;
};

export type Movie = {
  id: string;
  title: string;
  posterUrl?: string;
  backdropUrl?: string;
  synopsis: string;
  releaseYear: number;
  runtimeMin: number;
  genres: string[];
  language: string;
  director: string;
  cast: string[];
  ageRating: string;
  videoFileName?: string;
  subtitles: Subtitle[];
  dateAdded: string;
};

export type Episode = {
  id: string;
  number: number;
  title: string;
  synopsis: string;
  thumbnailUrl?: string;
  runtimeMin: number;
  videoFileName?: string;
  airDate?: string;
  subtitles: Subtitle[];
};

export type Season = {
  id: string;
  number: number;
  episodes: Episode[];
};

export type TVShow = {
  id: string;
  title: string;
  posterUrl?: string;
  backdropUrl?: string;
  synopsis: string;
  releaseYear: number;
  genres: string[];
  language: string;
  creator: string;
  cast: string[];
  ageRating: string;
  seasons: Season[];
  dateAdded: string;
};
