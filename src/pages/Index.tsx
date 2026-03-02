import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import PromptInput from '@/components/PromptInput';
import SimulationViewer from '@/components/SimulationViewer';
import ParametersPanel from '@/components/ParametersPanel';
import SimulationStatus, { type SimulationPhase } from '@/components/SimulationStatus';
import { runSimulation, type SimulationConfig, type SimulationResult } from '@/lib/simulation-engine';
import SimulationChat from '@/components/SimulationChat';
import { Atom } from 'lucide-react';

export default function Index() {
  const [phase, setPhase] = useState<SimulationPhase>('idle');
  const [error, setError] = useState<string>();
  const [config, setConfig] = useState<SimulationConfig | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSimulate = useCallback(async (prompt: string) => {
    setIsLoading(true);
    setError(undefined);
    setPhase('parsing');

    try {
      // Step 1: Parse prompt with AI
      const { data, error: fnError } = await supabase.functions.invoke('parse-simulation', {
        body: { prompt },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      const simConfig: SimulationConfig = data.config;
      setConfig(simConfig);
      setPhase('configuring');

      // Small delay for UX
      await new Promise(r => setTimeout(r, 600));
      setPhase('solving');

      // Step 2: Run simulation in browser
      await new Promise(r => setTimeout(r, 300));
      const simResult = runSimulation(simConfig);
      setResult(simResult);

      setPhase('complete');
      toast.success(`${simConfig.title} — simulation complete`);
    } catch (err) {
      console.error('Simulation error:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      setPhase('error');
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const showResults = result && config && (phase === 'complete' || phase === 'idle');

  return (
    <div className="min-h-screen bg-background grid-bg relative overflow-hidden">
      {/* Ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Atom className="w-5 h-5 text-primary" />
          <span className="font-semibold text-sm tracking-wide">PhysicsLab</span>
          <span className="text-xs font-mono text-muted-foreground ml-2">Joan Vendrell Gallart</span>
        </div>
        <div className="flex items-center gap-3">
          <SimulationStatus phase={phase} error={error} />
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10">
        <AnimatePresence mode="wait">
          {!showResults ? (
            <motion.div
              key="prompt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex items-center justify-center min-h-[calc(100vh-65px)] px-6"
            >
              <PromptInput onSubmit={handleSimulate} isLoading={isLoading} />
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-[calc(100vh-65px)] grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 p-4"
            >
              {/* 3D Viewer */}
              <div className="flex flex-col gap-3 min-h-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{config.title}</h2>
                    <p className="text-xs text-muted-foreground">{config.description}</p>
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  <SimulationViewer result={result} />
                </div>
                <PromptInput onSubmit={handleSimulate} isLoading={isLoading} compact />
              </div>

              {/* Parameters sidebar */}
              <div className="hidden lg:block overflow-y-auto">
                <ParametersPanel config={config} />
              </div>

              {/* Chat Q&A */}
              <SimulationChat config={config} result={result} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}