import { motion } from 'framer-motion';
import { Settings, Thermometer, Box, Ruler, Layers } from 'lucide-react';
import type { SimulationConfig } from '@/lib/simulation-engine';

interface ParametersPanelProps {
  config: SimulationConfig;
}

function ParamRow({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  const display = typeof value === 'number'
    ? (Math.abs(value) < 0.001 || Math.abs(value) > 1e6
      ? value.toExponential(2)
      : value.toLocaleString())
    : value;

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-mono text-foreground">
        {display}{unit ? <span className="text-muted-foreground ml-1">{unit}</span> : null}
      </span>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">{title}</span>
      </div>
      {children}
    </div>
  );
}

export default function ParametersPanel({ config }: ParametersPanelProps) {
  const typeLabels: Record<string, string> = {
    heat_transfer: 'Heat Transfer',
    solid_mechanics: 'Solid Mechanics',
    wave_propagation: 'Wave Propagation',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="bg-card border border-border rounded-xl p-4 overflow-y-auto"
    >
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
        <Settings className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Simulation Config</h3>
      </div>

      <Section icon={Layers} title="Type">
        <div className="px-2 py-1 rounded bg-primary/10 text-primary text-xs font-mono inline-block">
          {typeLabels[config.type] || config.type}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
      </Section>

      <Section icon={Box} title="Geometry">
        <ParamRow label="Shape" value={config.geometry.shape} />
        {Object.entries(config.geometry.dimensions).map(([key, val]) => (
          <ParamRow key={key} label={key} value={val} unit="m" />
        ))}
      </Section>

      <Section icon={Thermometer} title="Material">
        <ParamRow label="Material" value={config.material.name} />
        <ParamRow label="Density" value={config.material.density} unit="kg/m³" />
        {config.material.thermal_conductivity && (
          <ParamRow label="k" value={config.material.thermal_conductivity} unit="W/m·K" />
        )}
        {config.material.specific_heat && (
          <ParamRow label="Cp" value={config.material.specific_heat} unit="J/kg·K" />
        )}
        {config.material.youngs_modulus && (
          <ParamRow label="E" value={config.material.youngs_modulus} unit="Pa" />
        )}
        {config.material.poissons_ratio !== undefined && (
          <ParamRow label="ν" value={config.material.poissons_ratio} />
        )}
      </Section>

      <Section icon={Ruler} title="Solver">
        <ParamRow label="Grid" value={`${config.simulation.grid_resolution}×${Math.round(config.simulation.grid_resolution * 0.6)}`} />
        <ParamRow label="Time steps" value={config.simulation.time_steps} />
        <ParamRow label="dt" value={config.simulation.dt} unit="s" />
        <ParamRow label="Total time" value={config.simulation.total_time} unit="s" />
      </Section>

      <Section icon={Thermometer} title="Boundary Conditions">
        <ParamRow label="Type" value={config.boundary_conditions.type} />
        <ParamRow label="Left" value={config.boundary_conditions.left.value} unit={config.boundary_conditions.left.type === 'temperature' ? 'K' : ''} />
        <ParamRow label="Right" value={config.boundary_conditions.right.value} unit={config.boundary_conditions.right.type === 'temperature' ? 'K' : ''} />
        {config.boundary_conditions.top && (
          <ParamRow label="Top" value={config.boundary_conditions.top.value} />
        )}
        {config.boundary_conditions.bottom && (
          <ParamRow label="Bottom" value={config.boundary_conditions.bottom.value} />
        )}
      </Section>

      {config.geometry.regions && config.geometry.regions.length > 0 && (
        <Section icon={Layers} title="Geometry Regions">
          {config.geometry.regions.map((region, i) => (
            <div key={i} className="mb-2 pb-2 border-b border-border/30 last:border-0">
              <ParamRow label={`Region ${i + 1}`} value={`${region.shape} (${region.type})`} />
              {region.shape === 'circle' && region.center && (
                <>
                  <ParamRow label="Center" value={`${region.center.x}, ${region.center.y}`} unit="m" />
                  <ParamRow label="Radius" value={region.radius || 0} unit="m" />
                </>
              )}
              {region.shape === 'rectangle' && (
                <>
                  <ParamRow label="Position" value={`${region.x}, ${region.y}`} unit="m" />
                  <ParamRow label="Size" value={`${region.width}×${region.height}`} unit="m" />
                </>
              )}
            </div>
          ))}
        </Section>
      )}

      {config.materials && config.materials.length > 0 && (
        <Section icon={Box} title="Additional Materials">
          {config.materials.map((mat, i) => (
            <div key={i} className="mb-2 pb-2 border-b border-border/30 last:border-0">
              <ParamRow label={`Material ${i + 2}`} value={mat.name} />
              <ParamRow label="Density" value={mat.density} unit="kg/m³" />
              {mat.thermal_conductivity && (
                <ParamRow label="k" value={mat.thermal_conductivity} unit="W/m·K" />
              )}
            </div>
          ))}
        </Section>
      )}
    </motion.div>
  );
}
