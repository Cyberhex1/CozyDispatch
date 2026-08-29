import { UserProfile, NotificationAlert, WishlistItem } from '../types';

export const DEFAULT_USER_PROFILE: UserProfile = {
  id: 'cozy-pc-user-1',
  username: 'FernMeadow',
  gamerTag: 'Fern#1024',
  avatarIcon: 'sprout',
  bio: 'PC & Steam Deck indie enthusiast who loves warm teas, cottagecore farming, and relaxing gridless building toys.',
  favoriteVibe: 'Pastel Watercolor & Zero Combat',
  memberSince: 'August 2024',
  preferences: {
    notifyOnPriceDrops: true,
    notifyOnReleases: true,
    notifyOnPatches: true,
    preferredGenres: ['Farming Sim', 'Gridless Builder', 'Atmospheric', 'Cozy Castle', 'Roguelike Deckbuilder'],
    preferredStore: 'all',
    steamDeckOnly: false,
    minCozyScore: 8.5,
    dailyDigestOptIn: true
  }
};

export const DEFAULT_NOTIFICATIONS: NotificationAlert[] = [
  {
    id: 'notif-1',
    gameId: 'tiny-glade',
    gameTitle: 'Tiny Glade',
    gameCover: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=400&q=80',
    type: 'sale',
    title: 'Wishlist Item On Sale: Tiny Glade (20% Off)',
    message: 'Tiny Glade dropped to $11.99 on Steam (was $14.99). Sale ends in 4 days!',
    timestamp: '1 hour ago',
    isRead: false,
    discountPercent: 20,
    salePrice: '$11.99',
    originalPrice: '$14.99',
    storeUrl: 'https://store.steampowered.com/app/2198150/Tiny_Glade/'
  },
  {
    id: 'notif-2',
    gameId: 'fields-of-mistria',
    gameTitle: 'Fields of Mistria',
    gameCover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=80',
    type: 'patch',
    title: 'New Patch: Fields of Mistria v0.11.4',
    message: 'Strawberry cow breeding tier, town market fix, and Steam Deck optimization live now on Steam.',
    timestamp: 'Yesterday',
    isRead: false
  },
  {
    id: 'notif-3',
    gameId: 'unpacking',
    gameTitle: 'Unpacking',
    gameCover: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=400&q=80',
    type: 'sale',
    title: 'Historic Low Price: Unpacking (50% Off)',
    message: 'Unpacking reached an all-time low price of $9.99 on Steam and Epic Games Store.',
    timestamp: '2 days ago',
    isRead: true,
    discountPercent: 50,
    salePrice: '$9.99',
    originalPrice: '$19.99',
    storeUrl: 'https://store.steampowered.com/app/1135690/Unpacking/'
  }
];

export const DEFAULT_WISHLIST_ITEMS: WishlistItem[] = [
  {
    gameId: 'fields-of-mistria',
    addedAt: '2024-08-06',
    notifyOnSale: true,
    notifyOnRelease: true,
    priority: 'high',
    customNotes: 'My dream 90s anime farming sim on Steam Deck!'
  },
  {
    gameId: 'tiny-glade',
    addedAt: '2024-08-08',
    notifyOnSale: true,
    notifyOnRelease: false,
    priority: 'high',
    customNotes: 'Tactile castles, procedural ivy, and sheep petting.'
  },
  {
    gameId: 'haunted-chocolatier',
    addedAt: '2024-08-10',
    notifyOnSale: true,
    notifyOnRelease: true,
    priority: 'high',
    customNotes: 'From the creator of Stardew Valley. Day 1 Steam purchase.'
  }
];

export const AVATAR_OPTIONS = [
  { id: 'sprout', label: 'Fresh Sprout', emoji: '🌱', bg: 'bg-brand' },
  { id: 'tea', label: 'Steaming Tea', emoji: '🍵', bg: 'bg-brand-hover' },
  { id: 'mushroom', label: 'Cozy Mushroom', emoji: '🍄', bg: 'bg-accent' },
  { id: 'cat', label: 'Calico Cat', emoji: '🐱', bg: 'bg-[#DDA15E]' },
  { id: 'fox', label: 'Autumn Fox', emoji: '🦊', bg: 'bg-[#C58B6D]' },
  { id: 'castle', label: 'Tiny Castle', emoji: '🏰', bg: 'bg-[#606C38]' },
  { id: 'sparkles', label: 'Magic Dust', emoji: '✨', bg: 'bg-[#B08968]' },
  { id: 'coffee', label: 'Warm Latte', emoji: '☕', bg: 'bg-[#9C6644]' }
];
