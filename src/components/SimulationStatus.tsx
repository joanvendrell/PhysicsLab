import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, AlertCircle, Cpu, Brain, BarChart3 } from 'lucide-react';

export type SimulationPhase = 'idle' | 'parsing' | 'configuring' | 'solving' | 'complete' | 'error';

interface SimulationStatusProps {
  phase: SimulationPhase;
  error?: string;
}

const phases: { key: SimulationPhase; label: string; icon: React.ElementType }[] = [
  { key: 'parsing', label: 'Parsing prompt with AI', icon: Brain },
  { key: 'configuring', label: 'Configuring PDE system', icon: Cpu },
  { key: 'solving', label: 'Running FEM solver', icon: BarChart3 },
];

export default function SimulationStatus({ phase, error }: SimulationStatusProps) {
  if (phase === 'idle') return null;

  const currentIdx = phases.findIndex(p => p.key === phase);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 p-3 rounded-lg bg-card border border-border"
    >
      {phase === 'error' ? (
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm font-mono">{error || 'Simulation failed'}</span>
        </div>
      ) : phase === 'complete' ? (
        <div className="flex items-center gap-2 text-success">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm font-mono">Simulation complete</span>
        </div>
      ) : (
        phases.map((p, i) => {
          const isActive = p.key === phase;
          const isDone = currentIdx > i;
          const Icon = p.icon;

          return (
            <div key={p.key} className="flex items-center gap-2">
              {i > 0 && (
                <div className={`w-6 h-px ${isDone ? 'bg-primary' : 'bg-border'}`} />
              )}
              <div className={`flex items-center gap-1.5 ${isActive ? 'text-primary' : isDone ? 'text-success' : 'text-muted-foreground'}`}>
                {isActive ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
                <span className="text-xs font-mono">{p.label}</span>
              </div>
            </div>
          );
        })
      )}
    </motion.div>
  );
}
