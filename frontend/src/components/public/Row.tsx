import { Link } from "react-router-dom";
import PosterCard from "./PosterCard";

export default function Row({
  title,
  viewAllTo,
  items,
  aspect = "portrait",
  layout = "scroll",
}: {
  title: string;
  viewAllTo?: string;
  items: {
    id: string;
    to: string;
    title: string;
    posterUrl?: string;
    subtitle?: string;
    progress?: number;
    menu?: { label: string; onClick: () => void }[];
  }[];
  aspect?: "portrait" | "landscape";
  /** "scroll" (default) is the usual horizontal Netflix-style row. "grid"
   * wraps every item into a fixed column grid instead — for rows meant to
   * show everything at once (e.g. Continue Watching) rather than something
   * you're expected to horizontally scroll through. */
  layout?: "scroll" | "grid";
}) {
  if (items.length === 0) return null;
  const gridCols = aspect === "landscape" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6";
  return (
    <section className="px-5 py-4 sm:px-8">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-base font-bold sm:text-lg" style={{ fontFamily: "var(--r-font-heading)", color: "var(--r-text)" }}>
          {title}
        </h2>
        {viewAllTo && (
          <Link
            to={viewAllTo}
            className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--r-text-muted)" }}
          >
            View All ›
          </Link>
        )}
      </div>
      {/* overflow-x-auto forces overflow-y to compute as "auto" too (CSS spec), so a
      hover transform (scale + translateY) on a card can get clipped at the
      bottom without some buffer here — pb-4 covers that with room to spare
      and gives the row some breathing room below the posters (dropping this
      entirely clipped the hover-scaled card outright, which read worse than
      the row sitting a bit close to the section's own py-4 below it).
      Left edge has the same clipping issue: the first card sits flush against
      the scroll box's own left edge, so its hover scale() grows a couple px past
      that edge and gets clipped there too — pl-2 gives it that room, -ml-2
      cancels the shift so the row still starts at the same visual x position.
      The mask fade (x-axis only, so it doesn't touch that vertical headroom) turns
      the last visible card's abrupt clip at the row's edge into a "there's more if
      you scroll" cue instead of it just looking cut off. */}
      <div
        className={layout === "grid" ? `grid ${gridCols} gap-4 pt-3` : "no-scrollbar -ml-2 flex gap-3 overflow-x-auto pb-4 pl-2 pt-3"}
        style={
          layout === "scroll"
            ? {
                WebkitMaskImage: "linear-gradient(to right, black, black calc(100% - 56px), transparent 100%)",
                maskImage: "linear-gradient(to right, black, black calc(100% - 56px), transparent 100%)",
              }
            : undefined
        }
      >
        {items.map((item) => (
          <PosterCard
            key={item.id}
            to={item.to}
            title={item.title}
            posterUrl={item.posterUrl}
            subtitle={item.subtitle}
            progress={item.progress}
            menu={item.menu}
            aspect={aspect}
            fixedWidth={layout === "scroll"}
          />
        ))}
      </div>
    </section>
  );
}
