"use client";

type Category = { slug: string; name: string };

type CategoryRailProps = {
  categories: Category[];
  active: string | null;
  onSelect: (slug: string | null) => void;
};

export function CategoryRail({ categories, active, onSelect }: CategoryRailProps) {
  if (!categories.length) return null;

  const chip =
    "h-10 px-5 rounded-full text-sm whitespace-nowrap snap-start transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atelie-clay focus-visible:ring-offset-2 focus-visible:ring-offset-atelie-cream";
  const idle = "bg-white/60 ring-1 ring-black/10 text-atelie-ink hover:bg-white";
  const selected = "bg-atelie-ink text-atelie-cream";

  return (
    <div className="sticky top-[96px] z-30 bg-atelie-cream/85 backdrop-blur-md border-b border-black/5">
      <nav aria-label="Categorias" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide snap-x py-3">
          <button type="button" onClick={() => onSelect(null)} aria-pressed={active === null} className={`${chip} ${active === null ? selected : idle}`}>
            Tudo
          </button>
          {categories.map((category) => {
            const isActive = active === category.slug;
            return (
              <button
                key={category.slug}
                type="button"
                onClick={() => onSelect(category.slug)}
                aria-pressed={isActive}
                className={`${chip} ${isActive ? selected : idle}`}
              >
                {category.name}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
