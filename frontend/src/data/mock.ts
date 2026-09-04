let idCounter = 1000;
export function nextId() {
  idCounter += 1;
  return String(idCounter);
}

export const GENRE_OPTIONS = [
  "Action", "Drama", "Comedy", "Sci-Fi", "Thriller", "Horror", "Documentary",
  "Fantasy", "Romance", "Animation", "Crime", "Mystery",
];

export const AGE_RATINGS = ["G", "PG", "PG-13", "R", "NC-17", "TV-Y", "TV-14", "TV-MA"];
