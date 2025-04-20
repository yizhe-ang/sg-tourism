import { CameraControls, Sky, useFBO, useTexture } from "@react-three/drei";
import { Perf } from "r3f-perf";
import { EffectComposer } from "@react-three/postprocessing";
import Blend from "./Blend.jsx";
import { useRef, useEffect, useMemo } from "react";
import { button, folder, useControls } from "leva";
import River from "./River.jsx";
import { createPortal, extend, useFrame, useThree } from "@react-three/fiber";
import CustomNormalMaterial from "./customNormalMaterial";
import WatercolorMaterial from "./watercolorMaterial.js";
import { useBrush } from "@funtech-inc/use-shader-fx";
import * as THREE from "three";

extend({ WatercolorMaterial });

export default function Experience() {
  const watercolorMaterialRef = useRef();
  const cameraControlsRef = useRef();

  const { size, dpr } = useThree((state) => {
    return { size: state.size, dpr: state.viewport.dpr };
  });

  useControls({
    camera: folder(
      {
        getLookAt: button(() => {
          const position = cameraControlsRef.current.getPosition();
          const target = cameraControlsRef.current.getTarget();
          console.log([...position, ...target]);
        }),
        toJson: button(() => console.log(cameraControlsRef.current.toJSON())),
      },
      {
        collapsed: true,
      }
    ),
  });

  const brushProps = useControls({
    brush: folder(
      {
        // radius: { value: 0.05, min: 0, max: 0.1, step: 0.01 },
        // smudge: { value: 0, min: 0, max: 10, step: 0.01 },
        // dissipation: { value: 1, min: 0, max: 1, step: 0.01 },
        // motionBlur: { value: 0, min: 0, max: 10, step: 0.01 },
        // motionSample: { value: 5, min: 0, max: 20, step: 1 },
        radius: { value: 0.1, min: 0, max: 0.1, step: 0.01 },
        smudge: { value: 10, min: 0, max: 10, step: 0.01 },
        dissipation: { value: 1, min: 0, max: 1, step: 0.01 },
        motionBlur: { value: 0, min: 0, max: 10, step: 0.01 },
        motionSample: { value: 5, min: 0, max: 20, step: 1 },
      },
      { collapsed: true }
    ),
  });
  const blendProps = useControls({
    blend: folder({
      type: {
        value: 1.0,
        options: {
          original: 0.0,
          sketch: 1.0,
          paint: 2.0,
          blended: 3.0,
        },
      },
      radius: { value: 5, min: 1, max: 35, step: 1 },
      amplitude: { value: 2, min: 0, max: 5, step: 0.1 },
      frequency: { value: 0.08, min: 0, max: 0.15, step: 0.01 },
      outlineThreshold: { value: 0.38, min: 0, max: 1.1, step: 0.01 },
      // outlineColor: "#511E33",
      outlineColor: "#80415b",
      shadowType: {
        value: 3.0,
        options: {
          tonal: 1.0,
          raster: 2.0,
          crosshatch: 3.0,
        },
      },
    }),
  });

  const { directionalLightIntensity, ambientLightIntensity } = useControls({
    scene: folder({
      directionalLightIntensity: { value: 5.5, min: 0, max: 10, step: 0.1 },
      ambientLightIntensity: { value: 1.6, min: 0, max: 10, step: 0.1 },
    }),
  });

  // Create an all-white texture
  const whiteTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, 1, 1);
    return new THREE.CanvasTexture(canvas);
  }, []);

  const watercolorTexture = useTexture("textures/watercolor_2.jpg");
  const cloudTexture = useTexture("textures/cloud-noise.png");

  const normalRenderTarget = useFBO();

  const [updateBrush, , { output: brushTexture }] = useBrush({
    size,
    // FIXME: Can lower this for performance
    dpr,
  });

  // Ping-pong watercolor dissipation effect
  const watercolorScene = useMemo(() => new THREE.Scene(), []);
  const watercolorCamera = useMemo(
    () => new THREE.OrthographicCamera(-1, 1, 1, -1, 1 / Math.pow(2, 53), 1),
    []
  );
  let targetA = useFBO();
  let targetB = useFBO();

  // Init camera position
  useEffect(() => {
    cameraControlsRef.current.setLookAt(
      ...[
        -0.000005510131148505397, 3.385863179632328, -0.010913183460704913,
        -0.0000021243210430414846, 4.6449795421207494e-10,
        -0.010913164502915206,
      ],
      false
    );
  }, []);

  useFrame((rootState, delta) => {
    const { gl, scene, camera } = rootState;

    updateBrush(rootState, brushProps);

    // Get normal information
    const originalSceneMaterial = scene.overrideMaterial;
    gl.setRenderTarget(normalRenderTarget);

    scene.matrixWorldNeedsUpdate = true;
    scene.overrideMaterial = CustomNormalMaterial;

    gl.render(scene, camera);

    scene.overrideMaterial = originalSceneMaterial;

    // Compute watercolor effect
    gl.setRenderTarget(targetA);
    gl.render(watercolorScene, watercolorCamera);

    watercolorMaterialRef.current.uBrush = brushTexture;
    watercolorMaterialRef.current.uPrev = targetA.texture;
    watercolorMaterialRef.current.uTime += delta;

    // Ping-pong swap
    let temp = targetA;
    targetA = targetB;
    targetB = temp;

    // Final
    gl.setRenderTarget(null);
  });

  return (
    <>
      <color args={["#ffffff"]} attach="background" />

      <EffectComposer>
        <Blend
          tNormal={normalRenderTarget.texture}
          watercolorTexture={watercolorTexture}
          cloudTexture={cloudTexture}
          trailTexture={targetA.texture}
          {...blendProps}
        />
        {/* <ToneMapping mode={ToneMappingMode.ACES_FILMIC} /> */}
      </EffectComposer>

      <Perf position="top-left" />

      <CameraControls ref={cameraControlsRef} />

      <Sky />

      <River />

      {createPortal(
        <>
          <mesh>
            <planeGeometry args={[2, 2]} />
            <watercolorMaterial
              ref={watercolorMaterialRef}
              key={WatercolorMaterial.key}
              uPrev={whiteTexture}
            ></watercolorMaterial>
          </mesh>
        </>,
        watercolorScene
      )}

      <directionalLight
        castShadow
        position={[1, 2, 3]}
        intensity={directionalLightIntensity}
      />
      <ambientLight intensity={ambientLightIntensity} />
    </>
  );
}
