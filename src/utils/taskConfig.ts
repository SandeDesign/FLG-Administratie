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
