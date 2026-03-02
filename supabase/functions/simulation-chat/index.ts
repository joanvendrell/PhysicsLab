import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, simulationContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a physics simulation expert assistant. You have access to the details of a simulation that the user just ran. Answer questions about the physics, results, parameters, and methodology.

Here is the simulation context:
- Type: ${simulationContext.type}
- Title: ${simulationContext.title}
- Description: ${simulationContext.description}
- Material: ${simulationContext.material?.name} (density: ${simulationContext.material?.density} kg/m³)
- Geometry: ${simulationContext.geometry?.shape}, dimensions: ${JSON.stringify(simulationContext.geometry?.dimensions)}
- Boundary Conditions: ${JSON.stringify(simulationContext.boundary_conditions)}
- Solver: grid ${simulationContext.simulation?.grid_resolution}, ${simulationContext.simulation?.time_steps} time steps, dt=${simulationContext.simulation?.dt}s
${simulationContext.material?.thermal_conductivity ? `- Thermal conductivity: ${simulationContext.material.thermal_conductivity} W/m·K` : ''}
${simulationContext.material?.specific_heat ? `- Specific heat: ${simulationContext.material.specific_heat} J/kg·K` : ''}
${simulationContext.material?.youngs_modulus ? `- Young's modulus: ${simulationContext.material.youngs_modulus} Pa` : ''}
${simulationContext.resultSummary ? `- Result summary: min=${simulationContext.resultSummary.min}, max=${simulationContext.resultSummary.max}` : ''}

Be concise, use proper physics terminology, and reference the actual simulation parameters in your answers. Use markdown for formatting. Keep answers focused and under 200 words unless the user asks for detail.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI error:", response.status, text);
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("simulation-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
