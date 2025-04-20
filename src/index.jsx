import "./style.css";
import ReactDOM from "react-dom/client";
import { Canvas } from "@react-three/fiber";
import Experience from "./Experience.jsx";
import { Loader } from "@react-three/drei";
import { Leva } from "leva";

const root = ReactDOM.createRoot(document.querySelector("#root"));

root.render(
  <>
    <Leva hidden={true} />
    <Loader />
    <Canvas
      // shadows
      camera={{
        fov: 45,
        near: 0.1,
        far: 200,
        // position: [ 4, 2, 6 ]
      }}
    >
      <Experience />
    </Canvas>
  </>
);
