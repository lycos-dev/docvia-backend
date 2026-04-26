// src/shared/components/ui/DeadlineBadge.tsx
// Small pill/badge showing deadline status colour + days left.
// Drop it anywhere: Dashboard card, Roadmap header, Progress page.

import { motion } from 'framer-motion';
import { Clock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useDeadlineStatus } from '../../hooks/useDeadlineStatus';

interface DeadlineBadgeProps {
  documentId: string;
  /** Optional extra class names */
  className?: string;
}

export default function DeadlineBadge({ documentId, className }: DeadlineBadgeProps) {
  const { status, daysLeft, dailyTarget } = useDeadlineStatus(documentId);

  if (status === 'none') return null;

  const config = {
    'on-track': {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-700 dark:text-green-400',
      icon: <CheckCircle2 size={12} />,
      label:
        daysLeft === 0
          ? 'Due today'
          : `${daysLeft}d left · ${dailyTarget} lesson${dailyTarget !== 1 ? 's' : ''}/day`,
    },
    behind: {
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      text: 'text-yellow-700 dark:text-yellow-400',
      icon: <AlertTriangle size={12} />,
      label: `${daysLeft}d left · need ${dailyTarget} lesson${dailyTarget !== 1 ? 's' : ''}/day`,
    },
    overdue: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-700 dark:text-red-400',
      icon: <XCircle size={12} />,
      label: 'Overdue',
    },
  } as const;

  const { bg, text, icon, label } = config[status];

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18 }}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        bg,
        text,
        className
      )}
    >
      {icon}
      {label}
      {status === 'on-track' && <Clock size={11} className="ml-0.5 opacity-60" />}
    </motion.span>
  );
}