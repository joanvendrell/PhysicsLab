import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a physics simulation configuration engine. Given a natural language description of a physics simulation, extract the parameters and return a structured JSON configuration.

You MUST respond with ONLY valid JSON, no markdown, no explanation. The JSON must follow this schema:

{
  "type": "heat_transfer" | "solid_mechanics" | "wave_propagation",
  "title": "short descriptive title",
  "description": "one-line summary of the simulation",
  "geometry": {
    "shape": "plate" | "rod" | "beam" | "cylinder" | "sphere" | "cube",
    "dimensions": {
      "length": number (meters),
      "width": number (meters, optional),
      "height": number (meters, optional),
      "radius": number (meters, optional)
    },
    "regions": [
      {
        "shape": "circle" | "rectangle",
        "type": "hole" | "material",
        "material_index": number (index into materials[] array, only when type="material"),
        "center": { "x": number, "y": number } (for circle, in meters),
        "radius": number (for circle, in meters),
        "x": number (for rectangle, top-left x in meters),
        "y": number (for rectangle, top-left y in meters),
        "width": number (for rectangle, in meters),
        "height": number (for rectangle, in meters)
      }
    ]
  },
  "material": {
    "name": "string",
    "thermal_conductivity": number (W/m·K, for heat transfer),
    "density": number (kg/m³),
    "specific_heat": number (J/kg·K, for heat transfer),
    "youngs_modulus": number (Pa, for solid mechanics),
    "poissons_ratio": number (for solid mechanics)
  },
  "materials": [
    {
      "name": "string",
      "thermal_conductivity": number,
      "density": number,
      "specific_heat": number,
      "youngs_modulus": number,
      "poissons_ratio": number
    }
  ],
  "boundary_conditions": {
    "type": "dirichlet" | "neumann" | "mixed",
    "left": { "type": "temperature" | "flux" | "fixed" | "force", "value": number },
    "right": { "type": "temperature" | "flux" | "fixed" | "force", "value": number },
    "top": { "type": "temperature" | "flux" | "fixed" | "force", "value": number, "optional": true },
    "bottom": { "type": "temperature" | "flux" | "fixed" | "force", "value": number, "optional": true }
  },
  "simulation": {
    "grid_resolution": number (10-100),
    "time_steps": number (50-500),
    "dt": number (seconds),
    "total_time": number (seconds)
  },
  "initial_conditions": {
    "temperature": number (K, for heat transfer),
    "displacement": number (m, for solid mechanics)
  }
}

IMPORTANT RULES for geometry regions:
- "regions" is optional. Only include it when the user describes holes, cutouts, inserts, or heterogeneous regions.
- Region coordinates must be within the geometry dimensions (0 to length, 0 to width/height).
- For holes (voids), use "type": "hole". The solver treats these as empty space.
- For multi-material inserts, use "type": "material" and reference a material in the "materials" array by index.
- "materials" is the array of ADDITIONAL materials (beyond the base "material"). Index 0 in materials = material_index 0 in regions.
- You can combine holes and material regions in the same geometry.

Use physically realistic values. If the user doesn't specify something, use reasonable defaults.
For nanoscale dimensions (nm), convert to meters (1 nm = 1e-9 m).
For heat transfer: typical metals have conductivity 10-400 W/m·K.
For solid mechanics: steel ~200 GPa, aluminum ~70 GPa.`;

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
          { role: "user", content: prompt },
        ],
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

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    jsonStr = jsonStr.trim();
    
    const config = JSON.parse(jsonStr);

    return new Response(JSON.stringify({ config }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-simulation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
