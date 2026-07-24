/**
 * Conversational workspace shell – same children, CSS decides columns.
 * pageType A: mobile one column; tablet context|main; desktop context|main|assist.
 */
export default function WorkspaceShell({
  header = null,
  context = null,
  main,
  assist = null,
  nav = null,
  desktopNav = null,
  mobileContext = null,
  className = '',
  withBottomNav = true,
  variant = 'triple',
}) {
  const classes = [
    'cn-workspace',
    variant === 'triple' ? 'cn-workspace--triple' : '',
    variant === 'split' || variant === 'triple' ? 'cn-workspace--split' : '',
    withBottomNav ? 'cn-workspace--with-bottom-nav' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {desktopNav}
      <div className="cn-workspace__stack">
        {header ? <div className="cn-workspace__header">{header}</div> : null}
        <div className="cn-workspace__body">
          {context ? (
            <aside className="cn-workspace__context" aria-label="Kundenkontext">
              {context}
            </aside>
          ) : null}
          <div className="cn-workspace__main">
            {mobileContext ? (
              <div className="cn-workspace__mobile-context">{mobileContext}</div>
            ) : null}
            {main}
          </div>
          {assist ? (
            <aside className="cn-workspace__assist" aria-label="Clever">
              {assist}
            </aside>
          ) : null}
        </div>
        {nav ? <div className="cn-workspace__nav cn-hide-desktop-nav">{nav}</div> : null}
      </div>
    </div>
  );
}
