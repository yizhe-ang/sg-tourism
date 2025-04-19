const glsl = /* glsl */ `

const mat3 Sx = mat3( -1, -2, -1, 0, 0, 0, 1, 2, 1 );
const mat3 Sy = mat3( -1, 0, 1, -2, 0, 2, -1, 0, 1 );

float hash(vec2 p) {
  vec3 p3  = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);

  return fract((p3.x + p3.y) * p3.z);
}

float getSketchyOutline(float frequency, float amplitude, vec2 resolution, vec2 uv, float outlineThickness, vec2 texelSize, sampler2D tNormal) {
  // Slight Outline distortion
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

  float outline = gradientDepth * 25.0 + gradientNormal;

  return outline;
}
`

export default glsl