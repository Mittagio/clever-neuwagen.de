import Header from './Header';
import './PageShell.css';

export default function PageShell({ children, className = '' }) {
  return (
    <div className="shell">
      <Header />
      <main className={`shell-main ${className}`}>{children}</main>
    </div>
  );
}
