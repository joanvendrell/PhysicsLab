import { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Loader2 } from 'lucide-react';

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
  compact?: boolean;
}

const EXAMPLES = [
  "Simulate heat transfer through a copper plate with a circular hole in the center",
  "Model a steel beam with two rectangular cutouts under 10kN load",
  "Heat diffusion in an aluminum plate with a copper insert in the middle, heated to 800K on the left",
  "Thermal analysis of a plate with 3 circular holes, 500K left boundary",
];

export default function PromptInput({ onSubmit, isLoading, compact }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = () => {
    if (!prompt.trim() || isLoading) return;
    onSubmit(prompt.trim());
  };

  if (compact) {
    return (
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Describe a follow-up simulation..."
            className="w-full h-10 px-4 pr-12 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary transition-all"
            disabled={isLoading}
          />
          <button
            onClick={handleSubmit}
            disabled={isLoading || !prompt.trim()}
            className="absolute right-1 top-1 h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity hover:opacity-90"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-3xl mx-auto"
    >
      <div className="text-center mb-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-secondary/50 text-xs font-mono text-muted-foreground mb-4"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          FEM Solver Ready
        </motion.div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
          <span className="text-gradient">PhysicsLab</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Describe a physics simulation in natural language. We'll configure, solve, and visualize it in real-time.
        </p>
      </div>

      <div className="relative group">
        <div className="absolute -inset-px rounded-xl bg-gradient-to-r from-primary/20 via-glow-secondary/10 to-primary/20 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 blur-sm" />
        <div className="relative bg-card border border-border rounded-xl p-1">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="e.g., Simulate heat transfer through a thin 30nm copper conductor..."
            rows={3}
            className="w-full bg-transparent px-4 py-3 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none font-mono text-sm"
            disabled={isLoading}
          />
          <div className="flex items-center justify-between px-3 pb-2">
            <span className="text-xs text-muted-foreground">
              Press Enter to simulate
            </span>
            <button
              onClick={handleSubmit}
              disabled={isLoading || !prompt.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm disabled:opacity-40 transition-all hover:shadow-lg hover:shadow-primary/20"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Simulate
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs text-muted-foreground mb-2 text-center">Try an example:</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {EXAMPLES.map((ex, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              onClick={() => setPrompt(ex)}
              className="px-3 py-1.5 rounded-md border border-border bg-secondary/50 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all font-mono truncate max-w-xs"
            >
              {ex.length > 60 ? ex.slice(0, 57) + '...' : ex}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}