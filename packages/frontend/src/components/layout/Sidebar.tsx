import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import {
  LayoutDashboard, ShoppingCart, Package, Ticket, Handshake,
  Settings2, Building2, Shield, ParkingCircle, Heart,
  BarChart2, FileText, Zap, Bot, Settings, ChevronDown
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';

const NAV_ITEMS = [
  { path: '/dashboard',      label: 'Command Center',   icon: LayoutDashboard,  roles: ['*'] },
  { path: '/concessions',    label: 'Concessions',      icon: ShoppingCart,     roles: ['concessions_director', 'coo', 'general_manager', 'venue_owner', 'platform_super_admin'] },
  { path: '/merchandise',    label: 'Merchandise',      icon: Package,          roles: ['merchandise_director', 'coo', 'general_manager', 'venue_owner', 'platform_super_admin'] },
  { path: '/ticketing',      label: 'Ticketing',        icon: Ticket,           roles: ['ticketing_director', 'cfo', 'marketing_director', 'general_manager', 'venue_owner', 'platform_super_admin'] },
  { path: '/sponsorship',    label: 'Sponsorship',      icon: Handshake,        roles: ['sponsorship_director', 'cfo', 'general_manager', 'venue_owner', 'platform_super_admin'] },
  { path: '/operations',     label: 'Operations',       icon: Settings2,        roles: ['operations_director', 'coo', 'event_manager', 'general_manager', 'venue_owner', 'platform_super_admin'] },
  { path: '/facilities',     label: 'Facilities',       icon: Building2,        roles: ['facilities_manager', 'coo', 'operations_director', 'general_manager', 'venue_owner', 'platform_super_admin'] },
  { path: '/security',       label: 'Security',         icon: Shield,           roles: ['security_director', 'coo', 'event_manager', 'general_manager', 'venue_owner', 'platform_super_admin'] },
  { path: '/parking',        label: 'Parking',          icon: ParkingCircle,    roles: ['parking_director', 'coo', 'event_manager', 'general_manager', 'venue_owner', 'platform_super_admin'] },
  { path: '/fan-experience', label: 'Fan Experience',   icon: Heart,            roles: ['marketing_director', 'premium_hospitality_director', 'general_manager', 'venue_owner', 'platform_super_admin'] },
  { path: '/analytics',      label: 'Analytics',        icon: BarChart2,        roles: ['*'] },
  { path: '/reports',        label: 'Reports',          icon: FileText,         roles: ['*'] },
  { path: '/automations',    label: 'Automations',      icon: Zap,              roles: ['operations_director', 'coo', 'general_manager', 'venue_owner', 'platform_super_admin'] },
  { path: '/agents',         label: 'AI Agents',        icon: Bot,              roles: ['general_manager', 'coo', 'venue_owner', 'platform_super_admin'] },
  { path: '/settings',       label: 'Settings',         icon: Settings,         roles: ['*'] },
];

export function Sidebar() {
  const { user } = useUser();
  const location = useLocation();
  const { liveEvent, tenant } = useAppStore();
  const userRole = (user?.publicMetadata?.role as string) ?? 'event_manager';

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.roles.includes('*') || item.roles.includes(userRole),
  );

  return (
    <aside style={{
      height: '100%',
      background: 'var(--surface-default)',
      borderRight: '1px solid var(--border-default)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Logo block */}
      <div style={{
        padding: 'var(--space-5) var(--space-5)',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {tenant?.white_label_config?.logo_url ? (
            <img src={tenant.white_label_config.logo_url} alt="Venue Logo" style={{ height: 28, borderRadius: 6 }} />
          ) : (
            <div style={{
              width: 28, height: 28,
              background: 'var(--accent)',
              borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: '#000',
            }}>V</div>
          )}
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text-primary)' }}>
            {tenant?.white_label_config?.app_name ?? 'VenueIQ'}
          </span>
        </div>

        {/* Live event badge */}
        {liveEvent && (
          <div style={{
            background: 'rgba(232, 95, 74, 0.10)',
            border: '1px solid rgba(232, 95, 74, 0.25)',
            borderRadius: 'var(--radius)',
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 11,
          }}>
            <span className="live-dot" />
            <span style={{ color: 'var(--status-red)', fontWeight: 600, letterSpacing: '0.05em' }}>LIVE</span>
            <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
              {liveEvent.event_name}
            </span>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-3)' }}>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius)',
                marginBottom: 2,
                fontSize: 'var(--text-sm)',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: isActive ? 'var(--surface-elevated)' : 'transparent',
                transition: 'all var(--transition-fast)',
                textDecoration: 'none',
              }}
            >
              <Icon size={16} style={{ color: isActive ? 'var(--accent)' : 'inherit', flexShrink: 0 }} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* User block */}
      <div style={{
        padding: 'var(--space-4) var(--space-5)',
        borderTop: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
      }}>
        <div style={{
          width: 32, height: 32,
          borderRadius: '50%',
          background: 'var(--accent-dim)',
          border: '1px solid var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: 'var(--accent)',
          flexShrink: 0,
        }}>
          {user?.firstName?.[0] ?? 'U'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.fullName ?? 'User'}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
            {userRole.replace(/_/g, ' ')}
          </div>
        </div>

        {/* System status dot */}
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--status-green)', flexShrink: 0 }} title="All systems operational" />
      </div>
    </aside>
  );
}
