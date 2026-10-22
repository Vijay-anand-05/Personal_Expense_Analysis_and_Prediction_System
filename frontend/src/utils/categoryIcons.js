import {
  Utensils, Car, ShoppingBag, Receipt, Film, HeartPulse, GraduationCap, Plane, ShoppingCart,
  Home, Sparkles, Tag, Wallet, Coffee, Gift, Dumbbell, Smartphone, BookOpen,
} from 'lucide-react';

// Icon identifiers stored in the database -> Lucide components.
export const ICONS = {
  utensils: Utensils,
  car: Car,
  'shopping-bag': ShoppingBag,
  receipt: Receipt,
  film: Film,
  'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap,
  plane: Plane,
  'shopping-cart': ShoppingCart,
  home: Home,
  sparkles: Sparkles,
  tag: Tag,
  wallet: Wallet,
  coffee: Coffee,
  gift: Gift,
  dumbbell: Dumbbell,
  smartphone: Smartphone,
  'book-open': BookOpen,
};

export const ICON_IDS = Object.keys(ICONS);

export const getCategoryIcon = (id) => ICONS[id] || Tag;
