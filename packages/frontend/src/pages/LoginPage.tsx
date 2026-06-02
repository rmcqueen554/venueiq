import React from 'react';
import { SignIn } from '@clerk/clerk-react';
import { useAppStore } from '../store/appStore';

export function LoginPage() {
  const { tenant } = useAppStore();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--surface-base)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-8)',
    }}>
      <div style={{ marginBottom: 'var(--space-8)', textAlign: 'center' }}>
        <div style={{
          width: 48, height: 48,
          background: 'var(--accent)',
          borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 700, color: '#000',
          margin: '0 auto var(--space-4)',
        }}>V</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', color: 'var(--text-primary)', fontWeight: 400 }}>
          {tenant?.white_label_config?.app_name ?? 'VenueIQ'}
        </h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
          Stadium Operations Intelligence Platform
        </p>
      </div>

      <SignIn
        appearance={{
          baseTheme: undefined,
          elements: {
            rootBox: { width: '100%', maxWidth: 420 },
            card: { background: 'var(--surface-raised)', border: '1px solid var(--border-default)', borderRadius: 16, boxShadow: 'var(--shadow-modal)' },
            headerTitle: { fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontWeight: 400 },
            headerSubtitle: { color: 'var(--text-tertiary)' },
            formFieldInput: { background: 'var(--surface-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, color: 'var(--text-primary)' },
            formButtonPrimary: { background: 'var(--accent)', color: '#000', fontFamily: 'var(--font-body)', fontWeight: 600 },
            footerActionText: { color: 'var(--text-tertiary)' },
            footerActionLink: { color: 'var(--accent)' },
          },
        }}
      />
    </div>
  );
}
