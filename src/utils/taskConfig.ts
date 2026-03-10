import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Briefcase,
  FileText,
  DollarSign,
  Users,
  Folder,
  MoreHorizontal,
  XCircle,
  PlayCircle,
  Clock,
  CalendarDays,
  CalendarRange,
  CalendarClock,
  Repeat,
} from 'lucide-react';
import { TaskCategory, TaskPriority, TaskStatus, TaskFrequency } from '../types';

// Category configuratie
export const CATEGORY_CONFIG: Record<TaskCategory, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
}> = {
  operational: { icon: Briefcase, label: 'Operationeel', color: 'bg-blue-100 text-blue-700' },
  compliance: { icon: FileText, label: 'Compliance', color: 'bg-purple-100 text-purple-700' },
  financial: { icon: DollarSign, label: 'Financieel', color: 'bg-emerald-100 text-emerald-700' },
  hr: { icon: Users, label: 'HR', color: 'bg-indigo-100 text-indigo-700' },
  sales: { icon: Briefcase, label: 'Verkoop', color: 'bg-pink-100 text-pink-700' },
  contracts: { icon: FileText, label: 'Contracten', color: 'bg-orange-100 text-orange-700' },
  administration: { icon: Folder, label: 'Administratie', color: 'bg-teal-100 text-teal-700' },
  other: { icon: MoreHorizontal, label: 'Overig', color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' },
};

// Priority configuratie
export const PRIORITY_CONFIG: Record<TaskPriority, {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  low: { label: 'Laag', color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300', icon: Circle },
  medium: { label: 'Normaal', color: 'bg-blue-100 text-blue-700', icon: Circle },
  high: { label: 'Hoog', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700', icon: AlertCircle },
};

// Status configuratie
export const STATUS_CONFIG: Record<TaskStatus, {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  pending: { label: 'Te doen', color: 'bg-yellow-100 text-yellow-700', icon: Circle },
  in_progress: { label: 'Bezig', color: 'bg-blue-100 text-blue-700', icon: PlayCircle },
  completed: { label: 'Voltooid', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  overdue: { label: 'Te laat', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  cancelled: { label: 'Geannuleerd', color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300', icon: XCircle },
};

// Frequency labels
export const FREQUENCY_LABELS: Record<TaskFrequency, string> = {
  daily: 'Dagelijks',
  weekly: 'Wekelijks',
  monthly: 'Maandelijks',
  quarterly: 'Kwartaal',
  yearly: 'Jaarlijks',
};

// Frequency configuratie met iconen en kleuren
export const FREQUENCY_CONFIG: Record<TaskFrequency, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  bgColor: string;
}> = {
  daily: { icon: Clock, label: 'Dagelijks', color: 'text-rose-700 dark:text-rose-400', bgColor: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' },
  weekly: { icon: CalendarDays, label: 'Wekelijks', color: 'text-sky-700 dark:text-sky-400', bgColor: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400' },
  monthly: { icon: CalendarRange, label: 'Maandelijks', color: 'text-violet-700 dark:text-violet-400', bgColor: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400' },
  quarterly: { icon: CalendarClock, label: 'Kwartaal', color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
  yearly: { icon: Repeat, label: 'Jaarlijks', color: 'text-emerald-700 dark:text-emerald-400', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
};
