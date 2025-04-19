import { wrapEffect } from "@react-three/postprocessing";
import { Effect, EffectAttribute, BlendFunction } from "postprocessing";
import { forwardRef, useMemo } from "react";
import { Uniform } from "three";
import gradientNoise from "./gradientNoise";

const fragmentShader = /* glsl */ `
  #define SECTOR_COUNT 8

  uniform float radius;

  uniform sampler2D tNormal;
  uniform float frequency;
  uniform float amplitude;
  uniform float shadowType;
  uniform float outlineThickness;

  uniform sampler2D watercolorTexture;
  uniform sampler2D cloudTexture;

  uniform sampler2D trailTexture;

  ${gradientNoise}

  float random(vec2 c) {
      return fract(sin(dot(c.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }

  vec3 sampleColor(vec2 offset, vec2 resolution, sampler2D inputBuffer) {
      vec2 coord = (gl_FragCoord.xy + offset) / resolution;
      return texture2D(inputBuffer, coord).rgb;
  }

  float polynomialWeight(float x, float y, float eta, float lambda) {
      float polyValue = (x + eta) - lambda * (y * y);
      return max(0.0, polyValue * polyValue);
  }

  void getSectorVarianceAndAverageColor(float angle, float radius, out vec3 avgColor, out float variance) {
      vec3 weightedColorSum = vec3(0.0);
      vec3 weightedSquaredColorSum = vec3(0.0);
      float totalWeight = 0.0;

      float eta = 0.1;
      float lambda = 0.5;

      for (float r = 1.0; r <= radius; r += 1.0) {
          for (float a = -0.392699; a <= 0.392699; a += 0.196349) {
              vec2 sampleOffset = vec2(r * cos(angle + a), r * sin(angle + a));
              vec3 color = sampleColor(sampleOffset, resolution, inputBuffer);
              float weight = polynomialWeight(sampleOffset.x, sampleOffset.y, eta, lambda);

              weightedColorSum += color * weight;
              weightedSquaredColorSum += color * color * weight;
              totalWeight += weight;
          }
      }

      // Calculate average color and variance
      avgColor = weightedColorSum / totalWeight;
      vec3 varianceRes = (weightedSquaredColorSum / totalWeight) - (avgColor * avgColor);
      variance = dot(varianceRes, vec3(0.299, 0.587, 0.114)); // Convert to luminance
  }

  const mat3 Sx = mat3( -1, -2, -1, 0, 0, 0, 1, 2, 1 );
  const mat3 Sy = mat3( -1, 0, 1, -2, 0, 2, -1, 0, 1 );

  float hash(vec2 p) {
    vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);

    return fract((p3.x + p3.y) * p3.z);
  }

  float luma(vec3 color) {
    const vec3 magic = vec3(0.2125, 0.7154, 0.0721);
    return dot(magic, color);
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

  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor)
  {
    // KUWAHARA ################################################################
    vec3 sectorAvgColors[SECTOR_COUNT];
    float sectorVariances[SECTOR_COUNT];

    for (int i = 0; i < SECTOR_COUNT; i++) {
      float angle = float(i) * 6.28318 / float(SECTOR_COUNT); // 2π / SECTOR_COUNT
      getSectorVarianceAndAverageColor(angle, float(radius), sectorAvgColors[i], sectorVariances[i]);
    }

    float minVariance = sectorVariances[0];
    vec3 finalColor = sectorAvgColors[0];

    for (int i = 1; i < SECTOR_COUNT; i++) {
        if (sectorVariances[i] < minVariance) {
            minVariance = sectorVariances[i];
            finalColor = sectorAvgColors[i];
        }
    }

    vec3 kuwaharaColor = refineColor(finalColor);

    // SKETCH ##################################################################
    vec4 outlineColor = vec4(0.0, 0.0, 0.0, 1.0);

    vec4 pixelColor = inputColor;

    vec2 displacement = vec2(
      (hash(gl_FragCoord.xy) * sin(gl_FragCoord.y * frequency)) ,
      (hash(gl_FragCoord.xy) * cos(gl_FragCoord.x * frequency))
    ) * amplitude / resolution;

    float depth00 = readDepth(uv + displacement + outlineThickness * texelSize * vec2(-1, 1));
    float depth01 = readDepth(uv + displacement + outlineThickness * texelSize * vec2(-1, 0));
    float depth02 = readDepth(uv + displacement + outlineThickness * texelSize * vec2(-1, -1));

    float depth10 = readDepth(uv + displacement + outlineThickness * texelSize * vec2(0, -1));
    float depth11 = readDepth(uv + displacement + outlineThickness * texelSize * vec2(0, 0));
    float depth12 = readDepth(uv + displacement + outlineThickness * texelSize * vec2(0, 1));

    float depth20 = readDepth(uv + displacement + outlineThickness * texelSize * vec2(1, -1));
    float depth21 = readDepth(uv + displacement + outlineThickness * texelSize * vec2(1, 0));
    float depth22 = readDepth(uv + displacement + outlineThickness * texelSize * vec2(1, 1));

    // Sobel operations
    float xSobelValueDepth =
      Sx[0][0] * depth00 + Sx[1][0] * depth01 + Sx[2][0] * depth02 +
      Sx[0][1] * depth10 + Sx[1][1] * depth11 + Sx[2][1] * depth12 +
      Sx[0][2] * depth20 + Sx[1][2] * depth21 + Sx[2][2] * depth22;

    float ySobelValueDepth =
      Sy[0][0] * depth00 + Sy[1][0] * depth01 + Sy[2][0] * depth02 +
      Sy[0][1] * depth10 + Sy[1][1] * depth11 + Sy[2][1] * depth12 +
      Sy[0][2] * depth20 + Sy[1][2] * depth21 + Sy[2][2] * depth22;

    float gradientDepth = sqrt(pow(xSobelValueDepth, 2.0) + pow(ySobelValueDepth, 2.0));

    float normal00 = luma(texture2D(tNormal, uv + displacement + outlineThickness * texelSize * vec2(-1, -1)).rgb);
    float normal01 = luma(texture2D(tNormal, uv + displacement + outlineThickness * texelSize * vec2(-1, 0)).rgb);
    float normal02 = luma(texture2D(tNormal, uv + displacement + outlineThickness * texelSize * vec2(-1, 1)).rgb);

    float normal10 = luma(texture2D(tNormal, uv + displacement + outlineThickness * texelSize * vec2(0, -1)).rgb);
    float normal11 = luma(texture2D(tNormal, uv + displacement + outlineThickness * texelSize * vec2(0, 0)).rgb);
    float normal12 = luma(texture2D(tNormal, uv + displacement + outlineThickness * texelSize * vec2(0, 1)).rgb);

    float normal20 = luma(texture2D(tNormal, uv + displacement + outlineThickness * texelSize * vec2(1, -1)).rgb);
    float normal21 = luma(texture2D(tNormal, uv + displacement + outlineThickness * texelSize * vec2(1, 0)).rgb);
    float normal22 = luma(texture2D(tNormal, uv + displacement + outlineThickness * texelSize * vec2(1, 1)).rgb);

    float xSobelNormal =
      Sx[0][0] * normal00 + Sx[1][0] * normal10 + Sx[2][0] * normal20 +
      Sx[0][1] * normal01 + Sx[1][1] * normal11 + Sx[2][1] * normal21 +
      Sx[0][2] * normal02 + Sx[1][2] * normal12 + Sx[2][2] * normal22;

    float ySobelNormal =
      Sy[0][0] * normal00 + Sy[1][0] * normal10 + Sy[2][0] * normal20 +
      Sy[0][1] * normal01 + Sy[1][1] * normal11 + Sy[2][1] * normal21 +
      Sy[0][2] * normal02 + Sy[1][2] * normal12 + Sy[2][2] * normal22;

    float gradientNormal = sqrt(pow(xSobelNormal, 2.0) + pow(ySobelNormal, 2.0));

    // Add noise
    float noiseValue = noise(gl_FragCoord.xy);
    noiseValue = noiseValue * 2.0 - 1.0;
    noiseValue *= 10.0;

    float outline = gradientDepth * 25.0 + gradientNormal;

    // Stylized shadows
    float pixelLuma = luma(pixelColor.rgb);

    if (shadowType == 1.0) {
      if(pixelLuma <= 0.35 && depth <= 0.99) {
        pixelColor = vec4(0.0, 0.0, 0.0, 1.0);
      }

      if (pixelLuma <= 0.45 && depth <= 0.99) {
        pixelColor = pixelColor * vec4(0.25, 0.25, 0.25, 1.0);
      }

      if (pixelLuma <= 0.6 && depth <= 0.99) {
        pixelColor = pixelColor * vec4(0.5, 0.5, 0.5, 1.0);
      }

      if (pixelLuma <= 0.75 && depth <= 0.99) {
        pixelColor = pixelColor * vec4(0.7, 0.7, 0.7, 1.0);
      }
    }

    if (shadowType == 2.0) {
      const float rasterSize = 6.0;
      float raster = length(mod(uv * resolution.xy, vec2(rasterSize)) / rasterSize - vec2(0.5));

      if (pixelLuma <= raster * 1.25 && depth <= 0.99) {
        pixelColor = vec4(0.0, 0.0, 0.0, 1.0);
      }
    }

    float modVal = 11.0;

    if (shadowType == 3.0) {
      if (pixelLuma <= 0.35 && depth <= 0.99) {
        if (mod((uv.y + displacement.y) * resolution.y , modVal)  < outlineThickness) {
          pixelColor = outlineColor;
        };
      }
      if (pixelLuma <= 0.55 && depth <= 0.99) {
        if (mod((uv.x + displacement.x) * resolution.x , modVal)  < outlineThickness) {
          pixelColor = outlineColor;
        };
      }
      if (pixelLuma <= 0.80 && depth <= 0.99) {
        if (mod((uv.x + displacement.x) * resolution.y + (uv.y + displacement.y) * resolution.x, modVal) <= outlineThickness) {
          pixelColor = outlineColor;
        };
      }
    }

    // Grayscale
    vec4 grayscaleColor = vec4(vec3(luma(pixelColor.rgb)), 1.0);
    grayscaleColor = mix(grayscaleColor, outlineColor, outline);

    vec3 sketchColor = refineColor(grayscaleColor.rgb);

    // REFINEMENTS #############################################################
    // Blend using trail
    float trail = texture2D(trailTexture, uv).r;

    // vec3 blendedColor = mix(sketchColor, kuwaharaColor, trail);
    vec3 blendedColor = mix(kuwaharaColor, sketchColor, trail);

    // Apply watercolor texture
    vec4 watercolorColor = texture2D(watercolorTexture, uv);

    // FIXME: Blend first, then do all the refinement steps?

    // FIXME: Add extra colorful watercolor splotches
    // TODO: More dynamic watercolor effects

    // outputColor = vec4(blendedColor, 1.0) * watercolorColor;
    // outputColor = vec4(sketchColor, 1.0);
    // outputColor = texture2D(tNormal, uv);
    outputColor = vec4(vec3(outline), 1.0);
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
