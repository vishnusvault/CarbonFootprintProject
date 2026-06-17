import { NavLink } from 'react-router-dom';
import { Home, PlusCircle, Sparkles, TrendingUp, Bot } from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/log', icon: PlusCircle, label: 'Log' },
  { to: '/insights', icon: Sparkles, label: 'Insights' },
  { to: '/trends', icon: TrendingUp, label: 'Trends' },
  { to: '/ask', icon: Bot, label: 'Ask Leo' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          aria-label={label}
        >
          <span className="nav-icon" aria-hidden="true">
            <Icon size={22} />
          </span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

