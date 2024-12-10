import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const useAvatarStore = create(
  persist(
    (set, get) => ({
      // Audio state
      audioUrl: null,
      setAudioUrl: (url) => set({ audioUrl: url }),

      // Playing state
      isPlaying: false,
      setIsPlaying: (playing) => set({ isPlaying: playing }),

      // Lip sync data
      lipSyncData: [],
      setLipSyncData: (data) => set({ lipSyncData: data }),

      // Conversation history
      conversationHistory: [],
      addToConversationHistory: (message) => 
        set(state => ({
          conversationHistory: [...state.conversationHistory, message]
        })),
      
      // Clear conversation history
      clearConversationHistory: () => 
        set({ conversationHistory: [] }),
    }),
    {
      name: 'avatar-storage', // unique name
      storage: createJSONStorage(() => localStorage), // use localStorage
      partialize: (state) => ({
        conversationHistory: state.conversationHistory
      }), // only persist conversation history
    }
  )
);

export default useAvatarStore;