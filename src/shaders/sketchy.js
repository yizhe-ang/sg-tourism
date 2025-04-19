const glsl = /* glsl */ `

vec2 grad( ivec2 z )  // replace this anything that returns a random vector
{
    // 2D to 1D  (feel free to replace by some other)
    int n = z.x+z.y*11111;

    // Hugo Elias hash (feel free to replace by another one)
    n = (n<<13)^n;
    n = (n*(n*n*15731+789221)+1376312589)>>16;

    // Perlin style vectors
    n &= 7;
    vec2 gr = vec2(n&1,n>>1)*2.0-1.0;
    return ( n>=6 ) ? vec2(0.0,gr.x) :
           ( n>=4 ) ? vec2(gr.x,0.0) :
                              gr;
}

float noise( in vec2 p ) {
    ivec2 i = ivec2(floor( p ));
     vec2 f =       fract( p );

	vec2 u = f*f*(3.0-2.0*f); // feel free to replace by a quintic smoothstep instead

    return mix( mix( dot( grad( i+ivec2(0,0) ), f-vec2(0.0,0.0) ),
                     dot( grad( i+ivec2(1,0) ), f-vec2(1.0,0.0) ), u.x),
                mix( dot( grad( i+ivec2(0,1) ), f-vec2(0.0,1.0) ),
                     dot( grad( i+ivec2(1,1) ), f-vec2(1.0,1.0) ), u.x), u.y);
}

float valueAtPoint(sampler2D image, vec2 coord, vec2 texel, vec2 point) {
    vec3 luma = vec3(0.299, 0.587, 0.114);

    return dot(texture2D(image, coord + texel * point).xyz, luma);
}

float diffuseValue(int x, int y, vec2 uResolution, vec2 vUv, sampler2D uTexture, sampler2D tDiffuse) {
    float cutoff = 40.0;
    float offset =  0.5 / cutoff;

    // TODO: Adjust this noiseValue?
    float noiseValue = clamp(texture(uTexture, vUv).r, 0.0, cutoff) / cutoff - offset;

    return valueAtPoint(tDiffuse, vUv + noiseValue, vec2(1.0 / uResolution.x, 1.0 / uResolution.y), vec2(x, y)) * 0.6;
}

float normalValue(int x, int y, vec2 uResolution, vec2 vUv, sampler2D uTexture, sampler2D uNormals) {
    float cutoff = 50.0;
    float offset = 0.5 / cutoff;

    // TODO: Adjust this noiseValue?
    float noiseValue = clamp(texture(uTexture, vUv).r, 0.0, cutoff) / cutoff - offset;

    return valueAtPoint(uNormals, vUv + noiseValue, vec2(1.0 / uResolution.x, 1.0 / uResolution.y), vec2(x, y)) * 0.3;
}

float getValue(int x, int y, vec2 uResolution, vec2 vUv, sampler2D uTexture, sampler2D tDiffuse, sampler2D tNormals) {
    float noiseValue = noise(gl_FragCoord.xy);
    noiseValue = noiseValue * 2.0 - 1.0;
    noiseValue *= 10.0;

    return diffuseValue(x, y, uResolution, vUv, uTexture, tDiffuse) + normalValue(x, y, uResolution, vUv, uTexture, tNormals) * noiseValue;
}

float getSketchyOutline(vec2 vUv, vec2 uResolution, sampler2D uTexture, sampler2D tDiffuse, sampler2D tNormals, float outlineThreshold) {
    // kernel definition (in glsl matrices are filled in column-major order)
    const mat3 Gx = mat3(-1, -2, -1, 0, 0, 0, 1, 2, 1);// x direction kernel
    const mat3 Gy = mat3(-1, 0, 1, -2, 0, 2, -1, 0, 1);// y direction kernel

    // fetch the 3x3 neighbourhood of a fragment

    // first column
    float tx0y0 = getValue(-1, -1, uResolution, vUv, uTexture, tDiffuse, tNormals);
    float tx0y1 = getValue(-1, 0, uResolution, vUv, uTexture, tDiffuse, tNormals);
    float tx0y2 = getValue(-1, 1, uResolution, vUv, uTexture, tDiffuse, tNormals);

    // second column
    float tx1y0 = getValue(0, -1, uResolution, vUv, uTexture, tDiffuse, tNormals);
    float tx1y1 = getValue(0, 0, uResolution, vUv, uTexture, tDiffuse, tNormals);
    float tx1y2 = getValue(0, 1, uResolution, vUv, uTexture, tDiffuse, tNormals);

    // third column
    float tx2y0 = getValue(1, -1, uResolution, vUv, uTexture, tDiffuse, tNormals);
    float tx2y1 = getValue(1, 0, uResolution, vUv, uTexture, tDiffuse, tNormals);
    float tx2y2 = getValue(1, 1, uResolution, vUv, uTexture, tDiffuse, tNormals);

    // gradient value in x direction
    float valueGx = Gx[0][0] * tx0y0 + Gx[1][0] * tx1y0 + Gx[2][0] * tx2y0 +
    Gx[0][1] * tx0y1 + Gx[1][1] * tx1y1 + Gx[2][1] * tx2y1 +
    Gx[0][2] * tx0y2 + Gx[1][2] * tx1y2 + Gx[2][2] * tx2y2;

    // gradient value in y direction
    float valueGy = Gy[0][0] * tx0y0 + Gy[1][0] * tx1y0 + Gy[2][0] * tx2y0 +
    Gy[0][1] * tx0y1 + Gy[1][1] * tx1y1 + Gy[2][1] * tx2y1 +
    Gy[0][2] * tx0y2 + Gy[1][2] * tx1y2 + Gy[2][2] * tx2y2;

    // magnitude of the total gradient
    float G = (valueGx * valueGx) + (valueGy * valueGy);

    float sobelValue = clamp(G, 0.0, 1.0);
    // sobelValue = smoothstep(0.01, 0.03, sobelValue);

    // TODO: Randomness here?
    // You could adjust the line thickness by modulating the threshold of what is considered an edge based on a noise texture.
    float noiseValue = noise(gl_FragCoord.xy * 10.0);
    // noiseValue = noiseValue * 2.0 - 1.0;
    // noiseValue *= 10.0;

    // return step(outlineThreshold + noiseValue, sobelValue);
    return step(outlineThreshold, sobelValue);
}
`;

export default glsl;
