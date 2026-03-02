# AI Physics Lab

Build a web-based interface that allows users to run physics simulations (including but not limited to heat transfer and solid mechanics) directly from natural language prompts. For example, a user might type: **“Simulate the heat transfer through a thin 30 nm conductor.”**

## Approach

Adopt an **agentic architecture** (e.g., master-agent loops and MCPs) to orchestrate the simulator.

### Your system should

1. **Provide “zero-barrier” simulations**  
   The app should be hosted with everything preinstalled, so all a user needs to do is type in a prompt.

2. **Interpret the prompt**  
   Parse the natural language input and configure the appropriate PDE system.

3. **Set up and solve the model**  
   Use finite element simulations powered by **FEniCS / DOLFINx** on a backend server.

4. **Deliver results interactively**  
   Render the simulation results in the frontend as an interactive **3D visualization**, allowing users to zoom, rotate, and explore computed fields.

5. **Adaptability**  
   Easily extend to new PDEs, boundary conditions, materials, and geometries by adding:
   - parsing rules / entities
   - new solver modules
   - new frontend field renderers

---

## High-Level Architecture

- **Frontend**
  - Prompt input (natural language)
  - Interactive 3D viewer (rotate/zoom/pan)
  - Field selection (e.g., temperature / von Mises / velocity magnitude)

- **Backend**
  - Prompt parser → `PDESpec` (domain, PDE, geometry, material, mesh, BCs, outputs)
  - Solver execution (FEniCS / DOLFINx)
  - Artifact export (e.g., `.vtp` / VTK formats)
  - Results API (metadata + artifact URLs)

- **Orchestrator (Agentic Loop)**
  - Routes prompt to the correct pipeline (heat/solid/fluid/…)
  - Requests missing info when needed (clarifying questions)
  - Applies safe defaults when possible
  - Produces structured outputs (fields, units, ranges, artifacts)