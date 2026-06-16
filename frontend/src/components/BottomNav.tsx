import { NavLink } from 'react-router-dom';
import { Home, PlusCircle, Sparkles, TrendingUp, Leaf } from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/log', icon: PlusCircle, label: 'Log' },
  { to: '/insights', icon: Sparkles, label: 'Insights' },
  { to: '/trends', icon: TrendingUp, label: 'Trends' },
  { to: '/journey', icon: Leaf, label: 'Journey' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <span className="nav-icon">
            <Icon size={22} />
          </span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
