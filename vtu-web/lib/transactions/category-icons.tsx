// vtu-web/lib/transactions/category-icons.tsx

import {
  Smartphone,
  Wifi,
  Zap,
  Tv,
  BookOpen,
  MessageSquare,
  Wallet,
  ArrowUpFromLine,
  ArrowLeftRight,
  Package,
  Landmark,
  HandCoins,
  Ticket,
  RotateCcw,
  TrendingUp,
  Gift,
  Receipt,
  Globe,
  Banknote,
  CircleDollarSign,
} from 'lucide-react';
import type { ElementType } from 'react';

export const CATEGORY_ICONS: Record<string, ElementType> = {
  airtime: Smartphone,
  data: Wifi,
  electricity: Zap,
  cable: Tv,
  exam_pin: BookOpen,
  sms: MessageSquare,
  wallet_fund: Wallet,
  withdrawal: ArrowUpFromLine,
  transfer: ArrowLeftRight,
  bucket_purchase: Package,
  loan_disbursement: Landmark,
  loan_repayment: HandCoins,
  event_ticket: Ticket,
  refund: RotateCcw,
  commission: TrendingUp,
  cashback: Gift,
  fee: Receipt,
  internet: Globe,
  airtime_to_cash: Banknote,
};

export function categoryIcon(category: string): ElementType {
  return CATEGORY_ICONS[category] ?? CircleDollarSign;
}