const glsl = /* glsl */ `

vec3 getStylizedShadow(vec4 color, float shadowType, float depth, vec2 uv, vec2 resolution, vec2 displacement, float outlineThickness, vec4 outlineColor) {
  vec4 pixelColor = color;

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

  return pixelColor.rgb;
}
`;
