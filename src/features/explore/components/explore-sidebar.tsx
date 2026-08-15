export const ExploreSidebar = () => (
  <aside className="flex h-full min-h-0 flex-col overflow-hidden">
    <header className="border-b px-4 py-3">
      <h2 className="font-medium text-sm">Explore</h2>
      <p className="mt-0.5 text-muted-foreground text-xs">
        Filter courses using your preferences and degree progress.
      </p>
    </header>

    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
      <section>
        <h3 className="font-medium text-xs">Filters</h3>
        <p className="mt-1 text-muted-foreground text-xs">
          Course filters will live here.
        </p>
      </section>

      <section className="border-t pt-4">
        <h3 className="font-medium text-xs">Progress</h3>
        <p className="mt-1 text-muted-foreground text-xs">
          Degree progress will live here.
        </p>
      </section>
    </div>
  </aside>
);
