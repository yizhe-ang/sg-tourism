const glsl = /* glsl */ `

vec3 sampleColor(vec2 offset, vec2 resolution, sampler2D inputBuffer) {
    vec2 coord = (gl_FragCoord.xy + offset) / resolution;
    return texture2D(inputBuffer, coord).rgb;
}

float polynomialWeight(float x, float y, float eta, float lambda) {
    float polyValue = (x + eta) - lambda * (y * y);
    return max(0.0, polyValue * polyValue);
}

void getSectorVarianceAndAverageColor(float angle, float radius, out vec3 avgColor, out float variance, sampler2D inputBuffer, vec2 resolution) {
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

vec3 getKuwaharaColor(vec3 color, float radius, sampler2D inputBuffer, vec2 resolution) {
  int sectorCount = 8;

  vec3 sectorAvgColors[sectorCount];
  float sectorVariances[sectorCount];

  for (int i = 0; i < sectorCount; i++) {
    float angle = float(i) * 6.28318 / float(sectorCount); // 2π / sectorCount
    getSectorVarianceAndAverageColor(angle, float(radius), sectorAvgColors[i], sectorVariances[i], inputBuffer, resolution);
  }

  float minVariance = sectorVariances[0];
  vec3 finalColor = sectorAvgColors[0];

  for (int i = 1; i < sectorCount; i++) {
      if (sectorVariances[i] < minVariance) {
          minVariance = sectorVariances[i];
          finalColor = sectorAvgColors[i];
      }
  }

  return finalColor;
}
`;

export default glsl;
