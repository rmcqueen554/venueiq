import { create } from 'zustand';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatState {
  messages: ChatMessage[];
  sessionId: string;
  addMessage: (msg: ChatMessage) => void;
  clearHistory: () => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  messages: [],
  sessionId: crypto.randomUUID(),

  addMessage: (msg) => set((state) => ({
    messages: [...state.messages.slice(-20), msg], // keep last 10 turns
  })),

  clearHistory: () => set({ messages: [], sessionId: crypto.randomUUID() }),
}));
