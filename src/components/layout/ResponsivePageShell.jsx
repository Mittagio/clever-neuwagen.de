/**
 * Responsive page shell – marketing / reading / workspace / phone / wide.
 * Does not replace AppLayout; wraps page content width only.
 */
export default function ResponsivePageShell({
  children,
  variant = 'workspace',
  flush = false,
  className = '',
  as: Tag = 'div',
}) {
  const classes = [
    'cn-page',
    `cn-page--${variant}`,
    flush ? 'cn-page--flush' : '',
    className,
  ].filter(Boolean).join(' ');

  return <Tag className={classes}>{children}</Tag>;
}
