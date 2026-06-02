import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';

const theme = { surfaceBase: '#0A0B0E', surfaceRaised: '#161820', surfaceElevated: '#1D1F2A', accent: '#E8A838', textPrimary: 'rgba(255,255,255,0.95)', textSecondary: 'rgba(255,255,255,0.6)', textTertiary: 'rgba(255,255,255,0.35)', border: 'rgba(255,255,255,0.07)' };

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.venueiq.com';
const SESSION_ID = Math.random().toString(36).substring(7);

interface Message { role: 'user' | 'assistant'; content: string }

export default function ChatScreen() {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/nlq/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: text, session_id: SESSION_ID }),
      });

      if (!response.body) throw new Error('No stream');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      setMessages((m) => [...m, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'token') {
              fullContent += event.content;
              setMessages((m) => { const u = [...m]; u[u.length-1] = { role: 'assistant', content: fullContent }; return u; });
            }
          } catch {}
        }
      }
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Sorry, there was an error. Please try again.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [loading, getToken]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Advisor</Text>
        <Text style={styles.subtitle}>Ask anything about your venue</Text>
      </View>

      <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={{ padding: 16, gap: 12 }}>
        {messages.length === 0 && (
          <View>
            {['What happened at last night\'s event?', 'What are our top 3 priorities right now?', 'Which sponsors are underperforming?'].map((q) => (
              <TouchableOpacity key={q} onPress={() => sendMessage(q)} style={styles.suggestion}>
                <Text style={styles.suggestionText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {messages.map((msg, i) => (
          <View key={i} style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
            <Text style={styles.bubbleText}>{msg.content || (loading && i === messages.length - 1 ? 'Thinking...' : '')}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask anything..."
          placeholderTextColor={theme.textTertiary}
          style={styles.input}
          multiline
          returnKeyType="send"
          onSubmitEditing={() => sendMessage(input)}
        />
        <TouchableOpacity
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || loading}
          style={[styles.sendBtn, { opacity: input.trim() && !loading ? 1 : 0.4 }]}
        >
          <Text style={styles.sendBtnText}>→</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: theme.surfaceBase },
  header:          { padding: 24, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: theme.border },
  title:           { fontSize: 20, color: theme.textPrimary, fontWeight: '600' },
  subtitle:        { fontSize: 12, color: theme.textTertiary, marginTop: 2 },
  messages:        { flex: 1 },
  suggestion:      { backgroundColor: theme.surfaceRaised, borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.border },
  suggestionText:  { color: theme.textSecondary, fontSize: 14 },
  bubble:          { borderRadius: 12, padding: 14, maxWidth: '85%' },
  userBubble:      { backgroundColor: 'rgba(232,168,56,0.12)', borderWidth: 1, borderColor: 'rgba(232,168,56,0.3)', alignSelf: 'flex-end' },
  assistantBubble: { backgroundColor: theme.surfaceRaised, borderWidth: 1, borderColor: theme.border, alignSelf: 'flex-start' },
  bubbleText:      { color: theme.textPrimary, fontSize: 14, lineHeight: 22 },
  inputRow:        { flexDirection: 'row', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: theme.border, alignItems: 'flex-end' },
  input:           { flex: 1, backgroundColor: theme.surfaceElevated, borderRadius: 10, padding: 12, color: theme.textPrimary, fontSize: 15, maxHeight: 100 },
  sendBtn:         { backgroundColor: theme.accent, borderRadius: 10, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sendBtnText:     { fontSize: 20, color: '#000', fontWeight: '600' },
});
