import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import axios from 'axios';

const theme = { surfaceBase: '#0A0B0E', surfaceRaised: '#161820', accent: '#E8A838', green: '#3FBF7A', red: '#E85F4A', amber: '#F5C96A', textPrimary: 'rgba(255,255,255,0.95)', textSecondary: 'rgba(255,255,255,0.6)', textTertiary: 'rgba(255,255,255,0.35)', border: 'rgba(255,255,255,0.07)' };
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.venueiq.com';

const severityColors: Record<string, string> = { critical: theme.red, high: theme.amber, medium: '#5B9CF6', low: theme.green };

export default function ApprovalsScreen() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ['mobile-approvals'],
    queryFn: async () => {
      const token = await getToken();
      const { data } = await axios.get(`${API_BASE}/agents/approvals`, { headers: { Authorization: `Bearer ${token}` } });
      return data.data ?? [];
    },
    refetchInterval: 30_000,
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      await axios.post(`${API_BASE}/agents/approvals/${id}/approve`, { action: 'approve' }, { headers: { Authorization: `Bearer ${token}` } });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mobile-approvals'] }),
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      await axios.post(`${API_BASE}/agents/approvals/${id}/approve`, { action: 'reject' }, { headers: { Authorization: `Bearer ${token}` } });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mobile-approvals'] }),
  });

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Approval Queue</Text>
        <Text style={styles.subtitle}>{approvals.length} pending</Text>
      </View>

      {approvals.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>✓</Text>
          <Text style={styles.emptyLabel}>No pending approvals</Text>
        </View>
      ) : (
        approvals.map((item: any) => (
          <View key={item.id} style={[styles.card, { borderLeftColor: severityColors[item.severity] ?? theme.accent }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.severity, { color: severityColors[item.severity] ?? theme.accent }]}>
                {item.severity?.toUpperCase()}
              </Text>
              <Text style={styles.agent}>{item.agent_name?.replace(/_/g, ' ')}</Text>
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardBody} numberOfLines={3}>{item.body}</Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, styles.approveBtn]}
                onPress={() => Alert.alert('Approve', `Approve: ${item.title}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Approve', onPress: () => approve.mutate(item.id) },
                ])}
              >
                <Text style={styles.approveBtnText}>✓ Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.rejectBtn]}
                onPress={() => reject.mutate(item.id)}
              >
                <Text style={styles.rejectBtnText}>✗ Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: theme.surfaceBase },
  header:        { padding: 24, paddingTop: 60 },
  title:         { fontSize: 24, color: theme.textPrimary, fontWeight: '600' },
  subtitle:      { fontSize: 13, color: theme.textTertiary, marginTop: 4 },
  empty:         { alignItems: 'center', padding: 60 },
  emptyText:     { fontSize: 40, color: theme.green, marginBottom: 12 },
  emptyLabel:    { color: theme.textTertiary, fontSize: 15 },
  card:          { backgroundColor: theme.surfaceRaised, margin: 16, marginTop: 0, borderRadius: 12, padding: 16, borderLeftWidth: 3, borderWidth: 1, borderColor: theme.border },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  severity:      { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  agent:         { fontSize: 11, color: theme.textTertiary, textTransform: 'capitalize' },
  cardTitle:     { fontSize: 15, color: theme.textPrimary, fontWeight: '600', marginBottom: 6 },
  cardBody:      { fontSize: 13, color: theme.textSecondary, lineHeight: 20, marginBottom: 14 },
  actions:       { flexDirection: 'row', gap: 10 },
  btn:           { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  approveBtn:    { backgroundColor: theme.green },
  rejectBtn:     { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.border },
  approveBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },
  rejectBtnText:  { color: theme.textSecondary, fontSize: 13 },
});
