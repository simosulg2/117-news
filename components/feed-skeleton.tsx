export default function FeedSkeleton() {
  return (
    <main className="site-shell" aria-busy="true" aria-label="Uudiste laadimine">
      <header className="site-header skeleton-header">
        <div className="header-main container">
          <div className="skeleton-block skeleton-brand" />
          <div className="skeleton-block skeleton-search" />
          <div className="skeleton-block skeleton-circle" />
        </div>
        <div className="container skeleton-tabs">
          {[74, 68, 90, 78, 65, 82].map((width) => (
            <div key={width} className="skeleton-block" style={{ width }} />
          ))}
        </div>
      </header>
      <section className="container page-content">
        <div className="skeleton-block skeleton-kicker" />
        <div className="skeleton-block skeleton-title" />
        <div className="skeleton-grid">
          <div className="skeleton-block skeleton-feature" />
          <div className="skeleton-side">
            {[1, 2, 3, 4].map((item) => <div key={item} className="skeleton-block skeleton-card" />)}
          </div>
        </div>
      </section>
    </main>
  );
}
