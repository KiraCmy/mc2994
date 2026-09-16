const DEFAULT_ITEMS = [
  { id: '2d', label: '2D MAP', href: '#/2d' },
  { id: '3d', label: '3D WORLD', href: '#/3d' },
]

/** Compact folder-style tabs for the visualization pane. */
export default function ViewportTabs({
  active,
  items = DEFAULT_ITEMS,
  tabRef,
  ariaLabel = 'Viewport',
}) {
  return (
    <div ref={tabRef} className="viewport-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const selected = active === item.id
        const className = selected ? 'is-active' : ''

        if (item.href) {
          return (
            <a
              key={item.id}
              role="tab"
              aria-selected={selected}
              className={className}
              href={item.href}
            >
              {item.label}
            </a>
          )
        }

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={className}
            onClick={item.onClick}
            disabled={item.disabled}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
