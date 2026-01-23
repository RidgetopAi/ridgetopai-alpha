/**
 * ExpandablePanel - Reusable expandable content container
 *
 * Wraps content and provides an expand button to view in a fullscreen modal.
 * Used by Bug Fix, Content Generation, and Orchestrator panels.
 */

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ExpandablePanelProps {
  children: ReactNode;
  title?: string;
  /** Optional color accent: cyan (orchestrator), purple (bugfix), green (content) */
  accent?: 'cyan' | 'purple' | 'green' | 'yellow';
  /** Show expand button at top-right */
  showExpandButton?: boolean;
  /** Additional class for the container */
  className?: string;
}

const accentColors = {
  cyan: {
    border: 'border-cyan-500/30',
    header: 'bg-cyan-900/30',
    text: 'text-cyan-400',
  },
  purple: {
    border: 'border-purple-500/30',
    header: 'bg-purple-900/30',
    text: 'text-purple-400',
  },
  green: {
    border: 'border-green-500/30',
    header: 'bg-green-900/30',
    text: 'text-green-400',
  },
  yellow: {
    border: 'border-yellow-500/30',
    header: 'bg-yellow-900/30',
    text: 'text-yellow-400',
  },
};

export function ExpandablePanel({
  children,
  title,
  accent = 'purple',
  showExpandButton = true,
  className = '',
}: ExpandablePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const colors = accentColors[accent];

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      window.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isExpanded]);

  const ExpandButton = ({ expanded }: { expanded: boolean }) => (
    <button
      onClick={() => setIsExpanded(!expanded)}
      className={`p-1.5 rounded-md transition-colors ${colors.text} hover:bg-gray-700/50`}
      title={expanded ? 'Minimize' : 'Expand for detail view'}
    >
      {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
    </button>
  );

  // Inline (non-expanded) view
  const inlineContent = (
    <div className={`relative ${className}`}>
      {/* Expand button floating at top-right */}
      {showExpandButton && (
        <div className="absolute top-0 right-0 z-10">
          <ExpandButton expanded={false} />
        </div>
      )}
      {children}
    </div>
  );

  // Expanded modal view
  const expandedContent = (
    <AnimatePresence>
      {isExpanded && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={() => setIsExpanded(false)}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-4 md:inset-8 lg:inset-12 z-50 flex flex-col"
          >
            <div className={`flex-1 bg-gray-900 rounded-xl border ${colors.border} shadow-2xl overflow-hidden flex flex-col`}>
              {/* Header */}
              <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-800 ${colors.header}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${colors.text}`}>
                    {title || 'Detail View'}
                  </span>
                  <span className="text-xs text-gray-500">
                    Press ESC to close
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ExpandButton expanded={true} />
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {inlineContent}
      {expandedContent}
    </>
  );
}
