import { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActionButton } from '../shared/ActionButton';
import { useUIStore } from '../../stores/ui-store';
import { useCommandStore } from '../../stores/command-store';

const EXAMPLE_COMMANDS = [
  'Add user authentication with JWT',
  'Fix the navigation bug in sidebar',
  'Refactor database queries for performance',
  'Write unit tests for user service',
  'Update API documentation',
];

export function CommandInputOverlay() {
  const { commandInputOpen, closeCommandInput } = useUIStore();
  const { addCommand, startCommand } = useCommandStore();
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (commandInputOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [commandInputOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && commandInputOpen) {
        closeCommandInput();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!commandInputOpen) {
          useUIStore.getState().openCommandInput();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandInputOpen, closeCommandInput]);

  const handleSubmit = async () => {
    if (!input.trim()) return;

    setIsSubmitting(true);

    // Add command and start it immediately
    const commandId = addCommand(input.trim());
    startCommand(commandId);

    setInput('');
    setIsSubmitting(false);
    closeCommandInput();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  const handleExampleClick = (example: string) => {
    setInput(example);
    inputRef.current?.focus();
  };

  return (
    <AnimatePresence>
      {commandInputOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={closeCommandInput}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed top-1/4 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50"
          >
            <div className="bg-surface-1 rounded-xl border border-border-default shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent-primary" />
                  <span className="text-sm font-medium text-text-primary">
                    New Command
                  </span>
                </div>
                <button
                  onClick={closeCommandInput}
                  className="text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Input Area */}
              <div className="p-4">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Describe what you want to accomplish..."
                  className="w-full h-32 bg-surface-2 rounded-lg border border-border-subtle px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary resize-none"
                />

                {/* Example Commands */}
                <div className="mt-3">
                  <p className="text-xs text-text-tertiary mb-2">Try an example:</p>
                  <div className="flex flex-wrap gap-2">
                    {EXAMPLE_COMMANDS.slice(0, 3).map((example) => (
                      <button
                        key={example}
                        onClick={() => handleExampleClick(example)}
                        className="px-2 py-1 text-xs bg-surface-2 text-text-secondary rounded-md hover:bg-surface-3 hover:text-text-primary transition-colors"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle bg-surface-2/50">
                <div className="text-xs text-text-tertiary">
                  <kbd className="px-1.5 py-0.5 bg-surface-3 rounded">Cmd</kbd>
                  {' + '}
                  <kbd className="px-1.5 py-0.5 bg-surface-3 rounded">Enter</kbd>
                  {' to submit'}
                </div>
                <div className="flex items-center gap-2">
                  <ActionButton variant="ghost" size="md" onClick={closeCommandInput}>
                    Cancel
                  </ActionButton>
                  <ActionButton
                    variant="primary"
                    size="md"
                    icon={<Send className="w-4 h-4" />}
                    onClick={handleSubmit}
                    loading={isSubmitting}
                    disabled={!input.trim()}
                  >
                    Execute
                  </ActionButton>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
