import { create } from 'zustand';
import type { ViewMode, Notification } from '../lib/types';

interface UIStore {
  // View State
  activeView: ViewMode;
  detailPanelOpen: boolean;
  selectedItemId: string | null;
  selectedItemType: 'command' | 'agent' | null;

  // Notifications
  notifications: Notification[];

  // Modal State
  commandInputOpen: boolean;
  reviewOverlayOpen: boolean;
  reviewData: ReviewData | null;

  // Actions - Views
  setView: (view: ViewMode) => void;
  openDetail: (itemId: string, itemType: 'command' | 'agent') => void;
  closeDetail: () => void;

  // Actions - Notifications
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  clearNotifications: () => void;

  // Actions - Modals
  openCommandInput: () => void;
  closeCommandInput: () => void;
  openReviewOverlay: (data: ReviewData) => void;
  closeReviewOverlay: () => void;
}

interface ReviewData {
  commandId: string;
  question: string;
  options: string[];
  context?: string;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

export const useUIStore = create<UIStore>((set) => ({
  activeView: 'dashboard',
  detailPanelOpen: false,
  selectedItemId: null,
  selectedItemType: null,
  notifications: [],
  commandInputOpen: false,
  reviewOverlayOpen: false,
  reviewData: null,

  setView: (view) => set({ activeView: view }),

  openDetail: (itemId, itemType) =>
    set({
      detailPanelOpen: true,
      selectedItemId: itemId,
      selectedItemType: itemType,
    }),

  closeDetail: () =>
    set({
      detailPanelOpen: false,
      selectedItemId: null,
      selectedItemType: null,
    }),

  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: generateId(),
      timestamp: new Date(),
      read: false,
    };

    set((state) => ({
      notifications: [newNotification, ...state.notifications].slice(0, 50), // Keep last 50
    }));
  },

  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),

  clearNotifications: () => set({ notifications: [] }),

  openCommandInput: () => set({ commandInputOpen: true }),
  closeCommandInput: () => set({ commandInputOpen: false }),

  openReviewOverlay: (data) =>
    set({ reviewOverlayOpen: true, reviewData: data }),

  closeReviewOverlay: () =>
    set({ reviewOverlayOpen: false, reviewData: null }),
}));
