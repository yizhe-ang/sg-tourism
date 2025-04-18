import { shaderMaterial } from "@react-three/drei";
import * as THREE from "three";

const WatercolorMaterial = shaderMaterial(
  { uBrush: null, uPrev: null, uTime: 0, uResolution: new THREE.Vector2(1, 1) },
  // vertex shader
  /* glsl */ `
    varying vec2 vUv;

    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

      vUv = uv;
    }
  `,
  // fragment shader
  /* glsl */ `
    uniform sampler2D uBrush;
    uniform sampler2D uPrev;
    uniform vec2 uResolution;
    uniform float uTime;

    varying vec2 vUv;

    float rand(vec2 n) {
        return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
    }
    float noise(vec2 p) {
        vec2 ip = floor(p);
        vec2 u = fract(p);
        u = u*u*(3.0-2.0*u);
        float res = mix(
        mix(rand(ip), rand(ip+vec2(1.0, 0.0)), u.x), mix(rand(ip+vec2(0.0, 1.0)), rand(ip+vec2(1.0, 1.0)), u.x), u.y);
        return res*res;
    }
    float fbm(vec2 x, int numOctaves) {
        float v = 0.0;
        float a = 0.5;
        vec2 shift = vec2(100);
        // Rotate to reduce axial bias

        mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
        for (int i = 0; i < numOctaves; ++i) {
            v += a * noise(x);
            x = rot * x * 2.0 + shift;
            a *= 0.5;
        }
        return v;
    }

    float blendDarken(float base, float blend) {
    return min(blend, base);
    }
    vec3 blendDarken(vec3 base, vec3 blend) {
        return vec3(blendDarken(base.r, blend.r), blendDarken(base.g, blend.g), blendDarken(base.b, blend.b));
    }
    vec3 blendDarken(vec3 base, vec3 blend, float opacity) {
        return (blendDarken(base, blend) * opacity + base * (1.0 - opacity));
    }

    float hue2rgb(float f1, float f2, float hue) {
        if (hue < 0.0)
        hue += 1.0;
        else if (hue > 1.0)
        hue -= 1.0;
        float res;
        if ((6.0 * hue) < 1.0)
        res = f1 + (f2 - f1) * 6.0 * hue;
        else if ((2.0 * hue) < 1.0)
        res = f2;
        else if ((3.0 * hue) < 2.0)
        res = f1 + (f2 - f1) * ((2.0 / 3.0) - hue) * 6.0;
        else
        res = f1;
        return res;
    }
    vec3 hsl2rgb(vec3 hsl) {
        vec3 rgb;
        if (hsl.y == 0.0) {
            rgb = vec3(hsl.z); // Luminance
        }
        else {
            float f2;
            if (hsl.z < 0.5)
            f2 = hsl.z * (1.0 + hsl.y);
            else
            f2 = hsl.z + hsl.y - hsl.y * hsl.z;
            float f1 = 2.0 * hsl.z - f2;
            rgb.r = hue2rgb(f1, f2, hsl.x + (1.0/3.0));
            rgb.g = hue2rgb(f1, f2, hsl.x);
            rgb.b = hue2rgb(f1, f2, hsl.x - (1.0/3.0));
        }
        return rgb;
    }
    vec3 hsl2rgb(float h, float s, float l) {
        return hsl2rgb(vec3(h, s, l));
    }

    void main() {
      float brush = texture(uBrush, vUv).r;
      vec4 prev = texture(uPrev, vUv);

      vec2 aspect = vec2(1.0, uResolution.y / uResolution.x);

      // Increase flood after a set time
      // float floodStart = 0.01;
      // float floodEnd = 0.03;
      // float floodEnd = 0.015;
      // float floodMix = smoothstep(3.0, 4.0, uTime);

      float floodStart = 0.00;
      float floodEnd = 0.025;
      float floodMix = smoothstep(2.5, 4.0, uTime);

      float flood = mix(floodStart, floodEnd, floodMix);

      vec2 disp = fbm(vUv * 22.0, 4) * aspect * flood;

      vec4 texel = texture2D(uPrev, vUv);
      vec4 texel2 = texture2D(uPrev, vec2(vUv.x + disp.x, vUv.y));
      vec4 texel3 = texture2D(uPrev, vec2(vUv.x - disp.x, vUv.y));
      vec4 texel4 = texture2D(uPrev, vec2(vUv.x, vUv.y + disp.y));
      vec4 texel5 = texture2D(uPrev, vec2(vUv.x, vUv.y - disp.y));

      vec3 floodcolor = texel.rgb;
      floodcolor = blendDarken(floodcolor, texel2.rgb);
      floodcolor = blendDarken(floodcolor, texel3.rgb);
      floodcolor = blendDarken(floodcolor, texel4.rgb);
      floodcolor = blendDarken(floodcolor, texel5.rgb);

      // Give color to brush
      // vec3 gradient = hsl2rgb(fract(uTime * 0.1), 0.5, 0.5);
      // vec3 lcolor = mix(vec3(1.0), gradient, brush);
      vec3 lcolor = vec3(1.0 - brush);

      // Gradually fade out
      float fade1 = 0.7;
      vec3 waterColor = blendDarken(prev.rgb, floodcolor * (1.0 + 0.02), fade1);

      vec3 finalColor = blendDarken(waterColor, lcolor, 1.0);

      // More fading out
      float fade2 = 0.001;

      vec4 final = vec4(
        min(vec3(1.0), finalColor * (1.0 + 0.01) + fade2), 1.0
      );

      gl_FragColor = final;
    }
  `
);

export default WatercolorMaterial;
