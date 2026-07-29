"use client";

import { useCallback, useState } from "react";
import SceneCanvas from "@/components/canvases/scene-canvas";
import SimulationCanvas from "@/components/canvases/simulation-canvas";
import ScenarioSelection from "@/components/canvases/scenario-selection";
import { ScenarioEntry } from "@/types/scenario";

/**
 * Simulation page — scenario-based world loading with AI-driven cars.
 *
 * Flow:
 * 1. User sees the scenario selection screen on arrival.
 * 2. Selecting a scenario loads the world + brain and spawns AI cars.
 * 3. "Load Custom World" bypasses scenarios and uses the file picker.
 * 4. "Back to Scenarios" returns to step 1.
 */
export default function SimulationPage() {
  const [selectedScenario, setSelectedScenario] =
    useState<ScenarioEntry | null>(null);
  const [showScenarioSelection, setShowScenarioSelection] = useState(true);
  const [customWorldMode, setCustomWorldMode] = useState(false);

  /** User picked a scenario from the grid. */
  const handleSelectScenario = useCallback((scenario: ScenarioEntry) => {
    setSelectedScenario(scenario);
    setShowScenarioSelection(false);
    setCustomWorldMode(false);
  }, []);

  /** User chose "Load Custom World" — skip scenario selection and enter simulation. */
  const handleLoadCustom = useCallback(() => {
    setSelectedScenario(null);
    setShowScenarioSelection(false);
    setCustomWorldMode(true);
  }, []);

  /** Navigate back to the scenario selection screen. */
  const handleBackToScenarios = useCallback(() => {
    setSelectedScenario(null);
    setShowScenarioSelection(true);
    setCustomWorldMode(false);
  }, []);

  return (
    <>
      {/* Scenario selection overlay */}
      {showScenarioSelection && (
        <ScenarioSelection
          onSelectScenario={handleSelectScenario}
          onLoadCustom={handleLoadCustom}
        />
      )}

      {/* 3D canvas (always rendered so Three.js context stays alive) */}
      <SceneCanvas config={{ cameraPosition: { x: 0, y: 2000, z: 0 } }}>
        {(context) => (
          <SimulationCanvas
            scene={context.scene}
            camera={context.camera}
            dom={context.dom}
            scenarioName={selectedScenario?.name}
            worldUrl={
              selectedScenario && !customWorldMode
                ? selectedScenario.worldPath
                : undefined
            }
            onBackToScenarios={handleBackToScenarios}
          />
        )}
      </SceneCanvas>
    </>
  );
}
