import * as THREE from "three";

const normalShader = {
  uniforms: {},
  vertexShader: /* glsl */`
    varying vec3 vNormal;

    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

      vec3 transformedNormal = normalMatrix * normal;
      vNormal = normalize(transformedNormal);
    }
  `,
  fragmentShader: /* glsl */`
    varying vec3 vNormal;

    void main() {
      vec3 color = vec3(vNormal);

      gl_FragColor = vec4(color, 1.0);
    }
  `
}

const CustomNormalMaterial = new THREE.ShaderMaterial(normalShader);

export default CustomNormalMaterial;