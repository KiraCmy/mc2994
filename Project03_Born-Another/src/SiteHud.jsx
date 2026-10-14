/**
 * Shared site-header band. Pages with a scroller pass hidden/scrolled from
 * useAutoHideHeader so the bar slides away on scroll-down and back on scroll-up.
 */
export default function SiteHud({
  className = '',
  hidden = false,
  scrolled = false,
  children,
}) {
  const headerClass = [
    'hud site-hud',
    className,
    scrolled ? 'is-scrolled' : '',
    hidden ? 'is-hidden' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return <header className={headerClass}>{children}</header>
}
