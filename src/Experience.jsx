import {
  CameraControls,
  OrbitControls,
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
import { useRef, useEffect } from "react";
import { folder, useControls } from "leva";
import River from "./River.jsx";
import { extend, useFrame, useThree } from "@react-three/fiber";
import CustomNormalMaterial from "./customNormalMaterial";
import WatercolorMaterial from "./watercolorMaterial.js";
import { useBrush } from "@funtech-inc/use-shader-fx";

extend({ WatercolorMaterial });

export default function Experience() {
  const { size, dpr } = useThree((state) => {
    return { size: state.size, dpr: state.viewport.dpr };
  });

  // const fluidProps = useControls({
  //   fluid: folder({
  //     densityDissipation: { value: 0.98, min: 0, max: 1, step: 0.01 },
  //     velocityDissipation: { value: 0.99, min: 0, max: 1, step: 0.01 },
  //     velocityAcceleration: { value: 10, min: 0, max: 100, step: 1 },
  //     pressureDissipation: { value: 0.9, min: 0, max: 1, step: 0.01 },
  //     pressureIterations: { value: 20, min: 0, max: 30, step: 1 },
  //     curlStrength: { value: 35, min: 0, max: 100, step: 1 },
  //     splatRadius: { value: 0.002, min: 0, max: 0.2, step: 0.001 },
  //   }),
  // });

  const watercolorTexture = useTexture("textures/watercolor.png");

  const normalRenderTarget = useFBO();

  const [updateBrush, , { output: brushTexture }] = useBrush({
    size,
    dpr,
  });
  console.log(brushTexture)

  // const {
  //   render: updateFluid,
  //   texture: fluidTexture,
  //   setValues: setFluidParams,
  // } = useFluid({
  //   size: {
  //     width: size.width,
  //     height: size.height,
  //   },
  //   // FIXME: Can lower this for performance
  //   dpr: 1,
  // });

  useFrame((rootState) => {
    const { gl, scene, camera } = rootState;

    updateBrush(rootState)

    // Get normal information
    const originalSceneMaterial = scene.overrideMaterial;
    gl.setRenderTarget(normalRenderTarget);

    scene.matrixWorldNeedsUpdate = true;
    scene.overrideMaterial = CustomNormalMaterial;

    gl.render(scene, camera);

    scene.overrideMaterial = originalSceneMaterial;

    // Final
    gl.setRenderTarget(null);
  });

  return (
    <>
      {/* <color args={["#ffffff"]} attach="background" /> */}
      <color args={["black"]} attach="background" />

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
          trailTexture={brushTexture}
        />
        {/* <ToneMapping mode={ToneMappingMode.ACES_FILMIC} /> */}
      </EffectComposer>

      <Perf position="top-left" />

      <CameraControls />

      <Sky />

      <River />

      <directionalLight castShadow position={[1, 2, 3]} intensity={4.5} />
      <ambientLight intensity={1.5} />
    </>
  );
}
