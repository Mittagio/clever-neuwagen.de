import Header from './Header';
import './PageShell.css';

export default function PageShell({ children, className = '', hideMarketingHeader = false }) {
  return (
    <div className="shell">
      {!hideMarketingHeader && <Header />}
      <main className={`shell-main ${className}`}>{children}</main>
    </div>
  );
}
