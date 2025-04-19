import {
  CameraControls,
  OrbitControls,
  RenderTexture,
  Sky,
  useFBO,
  useTexture,
} from "@react-three/drei";
import { Perf } from "r3f-perf";
import {
  DepthOfField,
  Bloom,
  Noise,
  Glitch,
  Vignette,
  ToneMapping,
  EffectComposer,
} from "@react-three/postprocessing";
import { GlitchMode, BlendFunction, ToneMappingMode } from "postprocessing";
import Blend from "./Blend.jsx";
import { useRef, useEffect, useMemo } from "react";
import { folder, useControls } from "leva";
import River from "./River.jsx";
import { createPortal, extend, useFrame, useThree } from "@react-three/fiber";
import CustomNormalMaterial from "./customNormalMaterial";
import WatercolorMaterial from "./watercolorMaterial.js";
import { useBrush } from "@funtech-inc/use-shader-fx";
import * as THREE from "three";

extend({ WatercolorMaterial });

export default function Experience() {
  const watercolorMaterialRef = useRef();

  const { size, dpr } = useThree((state) => {
    return { size: state.size, dpr: state.viewport.dpr };
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
      radius: { value: 1, min: 1, max: 35, step: 1 },
      amplitude: { value: 2, min: 0, max: 5, step: 0.1 },
      frequency: { value: 0.08, min: 0, max: 0.15, step: 0.01 },
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

  const watercolorTexture = useTexture("textures/watercolor.png");
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
      {/* <color args={["black"]} attach="background" /> */}

      {/* FIXME: Play around with a bunch of post-processing effects */}
      <EffectComposer multisampling={0}>
        {/* <Vignette
                offset={ 0.3 }
                darkness={ 0.9 }
                blendFunction={ BlendFunction.NORMAL }
            /> */}
        {/* <Glitch
                delay={ [ 0.5, 1 ] }
                duration={ [ 0.1, 0.3 ] }
                strength={ [ 0.2, 0.4 ] }
                mode={ GlitchMode.CONSTANT_MILD }
            /> */}
        {/* <Noise
                premultiply
                blendFunction={ BlendFunction.SOFT_LIGHT }
            /> */}
        {/* <Bloom
                mipmapBlur
                intensity={ 0.5 }
                luminanceThreshold={ 0 }
            /> */}
        {/* <DepthOfField
                focusDistance={ 0.025 }
                focalLength={ 0.025 }
                bokehScale={ 6 }
            /> */}
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

      <CameraControls />

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

      <directionalLight castShadow position={[1, 2, 3]} intensity={4.5} />
      <ambientLight intensity={1.5} />
    </>
  );
}
