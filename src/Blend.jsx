import { wrapEffect } from "@react-three/postprocessing";
import { Effect, EffectAttribute, BlendFunction } from "postprocessing";
import { forwardRef, useMemo } from "react";
import { Uniform } from "three";
import gradientNoise from "./shaders/gradientNoise";
import sketchy from "./shaders/sketchy";

const fragmentShader = /* glsl */ `
  uniform float radius;

  uniform sampler2D tNormal;
  uniform float frequency;
  uniform float amplitude;
  uniform float shadowType;
  uniform float outlineThickness;

  uniform sampler2D watercolorTexture;
  uniform sampler2D cloudTexture;

  uniform sampler2D trailTexture;


  float luma(vec3 color) {
    const vec3 magic = vec3(0.2125, 0.7154, 0.0721);
    return dot(magic, color);
  }

  float random(vec2 c) {
      return fract(sin(dot(c.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }

  vec3 ACESFilm(vec3 x) {
      float a = 2.51;
      float b = 0.03;
      float c = 2.43;
      float d = 0.59;
      float e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  vec3 sat(vec3 rgb, float adjustment) {
      vec3 W = vec3(0.2125, 0.7154, 0.0721); // Luminance weights
      vec3 intensity = vec3(dot(rgb, W));
      return mix(intensity, rgb, adjustment);
  }

  vec3 refineColor(vec3 color) {
    vec3 refinedColor = color;

    vec3 grayscale = vec3(dot(refinedColor, vec3(0.299, 0.587, 0.114)));

    // color quantization
    int n = 16;
    float x = grayscale.r;
    float qn = floor(x * float(n - 1) + 0.5) / float(n - 1);
    qn = clamp(qn, 0.2, 0.7);

    if (qn < 0.5) {
        refinedColor = mix(vec3(0.1), refinedColor, qn * 2.0);
    } else {
        refinedColor = mix(refinedColor, vec3(1.0), (qn - 0.5) * 2.0);
    }

    refinedColor = sat(refinedColor, 1.5);

    refinedColor = ACESFilm(refinedColor);

    return refinedColor;
  }

  ${sketchy}

  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor)
  {
    vec4 outlineColor = vec4(0.32, 0.12, 0.2, 1.0);
    vec4 watercolorColor = texture2D(watercolorTexture, uv);

    // KUWAHARA ################################################################


    // vec3 kuwaharaColor = refineColor(finalColor);

    // SKETCH ##################################################################
    float sketchyOutline = getSketchyOutline(uv, resolution, cloudTexture, inputBuffer, tNormal);

    // Stylized shadows

    // Grayscale
    // vec4 grayscaleColor = vec4(vec3(luma(pixelColor.rgb)), 1.0);
    // grayscaleColor = mix(grayscaleColor, outlineColor, outline);

    // REFINEMENTS #############################################################
    // Blend using trail
    float trail = texture2D(trailTexture, uv).r;

    // vec3 blendedColor = mix(kuwaharaColor, sketchColor, trail);

    // Apply watercolor texture

    // FIXME: Blend first, then do all the refinement steps?

    // FIXME: Add extra colorful watercolor splotches
    // TODO: More dynamic watercolor effects

    vec4 o = outlineColor * sketchyOutline;

    // outputColor = vec4(vec3(sketchyOutline), 1.0);
    outputColor = o * watercolorColor;
    // outputColor = vec4(vec3(0.3), 1.0);
  }
`;

class BlendEffect extends Effect {
  constructor({
    radius = 5,
    tNormal,
    frequency = 0.05,
    amplitude = 2.0,
    shadowType = 2.0,
    outlineThickness = 0.5,
    watercolorTexture,
    cloudTexture,
    trailTexture,
  }) {
    const uniforms = new Map([
      ["radius", new Uniform(radius)],
      ["tNormal", new Uniform(tNormal)],
      ["frequency", new Uniform(frequency)],
      ["amplitude", new Uniform(amplitude)],
      ["shadowType", new Uniform(shadowType)],
      ["outlineThickness", new Uniform(outlineThickness)],
      ["watercolorTexture", new Uniform(watercolorTexture)],
      ["cloudTexture", new Uniform(cloudTexture)],
      ["trailTexture", new Uniform(trailTexture)],
    ]);

    super("Blend", fragmentShader, {
      attributes: EffectAttribute.DEPTH,
      // blendFunction: BlendFunction.NORMAL,
      uniforms,
    });

    this.uniforms = uniforms;
  }

  set radius(value) {
    this.uniforms.get("radius").value = value;
  }

  set frequency(value) {
    this.uniforms.get("frequency").value = value;
  }

  set amplitude(value) {
    this.uniforms.get("amplitude").value = value;
  }

  set shadowType(value) {
    this.uniforms.get("shadowType").value = value;
  }

  set outlineThickness(value) {
    this.uniforms.get("outlineThickness").value = value;
  }
}

const Blend = wrapEffect(BlendEffect);

export default Blend;
