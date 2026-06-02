import React from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import axios from 'axios';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.venueiq.com';

// Theme tokens (matching web tokens)
const theme = {
  surfaceBase:     '#0A0B0E',
  surfaceDefault:  '#0F1116',
  surfaceRaised:   '#161820',
  surfaceElevated: '#1D1F2A',
  accent:          '#E8A838',
  green:           '#3FBF7A',
  amber:           '#F5C96A',
  red:             '#E85F4A',
  blue:            '#5B9CF6',
  textPrimary:     'rgba(255,255,255,0.95)',
  textSecondary:   'rgba(255,255,255,0.60)',
  textTertiary:    'rgba(255,255,255,0.35)',
  border:          'rgba(255,255,255,0.07)',
};

function KPITile({ label, value, delta, color }: { label: string; value: string; delta?: string; color?: string }) {
  return (
    <View style={[styles.kpiTile, { borderTopColor: theme.accent }]}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, color ? { color } : {}]}>{value}</Text>
      {delta && <Text style={{ fontSize: 11, color: delta.startsWith('+') ? theme.green : theme.red, marginTop: 2 }}>{delta}</Text>}
    </View>
  );
}

export default function CommandCenterScreen() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['mobile-dashboard'],
    queryFn: async () => {
      const token = await getToken();
      const { data } = await axios.get(`${API_BASE}/executive/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data.data;
    },
    refetchInterval: 60_000,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['mobile-dashboard'] });
    setRefreshing(false);
  };

  const liveEvent = dashboard?.live_event;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>VenueIQ</Text>
        <Text style={styles.headerSubtitle}>Command Center</Text>
      </View>

      {/* Live event banner */}
      {liveEvent && (
        <View style={styles.liveBanner}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBannerText}>LIVE: {liveEvent.event_name}</Text>
          <Text style={styles.liveBannerSub}>T+{Math.floor((liveEvent.elapsed_minutes ?? 0) / 60)}:{String((liveEvent.elapsed_minutes ?? 0) % 60).padStart(2, '0')}</Text>
        </View>
      )}

      {/* KPI Grid */}
      <View style={styles.kpiGrid}>
        <KPITile label="Revenue" value={liveEvent ? `$${((dashboard?.kpi_strip?.total_revenue?.value ?? 0) / 1000).toFixed(0)}K` : '—'} delta="+8.2%" />
        <KPITile label="Attendance" value={String(Math.round(dashboard?.kpi_strip?.attendance?.value ?? 0) || '—')} delta="-3.1%" color={theme.amber} />
        <KPITile label="Concession/Cap" value={`$${(dashboard?.kpi_strip?.concession_per_cap?.value ?? 0).toFixed(2)}`} />
        <KPITile label="Active Alerts" value="4" color={theme.red} />
      </View>

      {/* Today's briefing preview */}
      {dashboard?.briefing && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>AI BRIEFING</Text>
          <Text style={styles.briefingText} numberOfLines={4}>{dashboard.briefing.content}</Text>
          <TouchableOpacity style={styles.readMore}>
            <Text style={styles.readMoreText}>Read full briefing</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Quick nav */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Access</Text>
        {[
          { label: 'Concessions',  route: '/(app)/concessions' },
          { label: 'Security',     route: '/(app)/security' },
          { label: 'Parking',      route: '/(app)/parking' },
          { label: 'AI Chat',      route: '/(app)/chat' },
          { label: 'Approvals',    route: '/(app)/approvals' },
          { label: 'My Alerts',    route: '/(app)/alerts' },
        ].map((item) => (
          <TouchableOpacity
            key={item.route}
            style={styles.quickNavItem}
            onPress={() => router.push(item.route as any)}
          >
            <Text style={styles.quickNavLabel}>{item.label}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: theme.surfaceBase },
  header:           { padding: 24, paddingTop: 60 },
  headerTitle:      { fontSize: 28, color: theme.textPrimary, fontWeight: '300', letterSpacing: -0.5 },
  headerSubtitle:   { fontSize: 13, color: theme.textTertiary, marginTop: 2 },
  liveBanner:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(232,95,74,0.08)', borderLeftWidth: 3, borderLeftColor: theme.red, marginHorizontal: 16, borderRadius: 8, padding: 12, marginBottom: 8 },
  liveDot:          { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.red },
  liveBannerText:   { flex: 1, color: theme.red, fontWeight: '600', fontSize: 13 },
  liveBannerSub:    { color: theme.textTertiary, fontSize: 12 },
  kpiGrid:          { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  kpiTile:          { width: '47%', backgroundColor: theme.surfaceRaised, borderRadius: 12, padding: 14, borderTopWidth: 2, borderColor: theme.accent },
  kpiLabel:         { fontSize: 10, color: theme.textTertiary, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  kpiValue:         { fontSize: 28, color: theme.textPrimary, fontWeight: '300' },
  card:             { backgroundColor: theme.surfaceRaised, margin: 16, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.border },
  cardLabel:        { fontSize: 10, color: theme.accent, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  briefingText:     { color: theme.textSecondary, fontSize: 14, lineHeight: 22, fontStyle: 'italic' },
  readMore:         { marginTop: 10 },
  readMoreText:     { color: theme.accent, fontSize: 12 },
  section:          { padding: 16 },
  sectionTitle:     { fontSize: 16, color: theme.textPrimary, fontWeight: '600', marginBottom: 12 },
  quickNavItem:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.surfaceRaised, borderRadius: 10, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: theme.border },
  quickNavLabel:    { color: theme.textPrimary, fontSize: 15 },
  chevron:          { color: theme.textTertiary, fontSize: 20 },
});
