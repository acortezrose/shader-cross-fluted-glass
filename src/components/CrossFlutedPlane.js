import React, { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const CrossFlutedShader = {
	vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
	fragmentShader: `
    uniform sampler2D uTexture;
    uniform float uSquareSize;
    uniform float uDistortion;
    uniform float uOpacity;
    uniform bool uEnabled;
    uniform float uRefraction;
    uniform float uMagnification;
    uniform vec2 uOffset;
    uniform bool uTiling;
    uniform float uZoom;
    uniform float uTime;
    uniform float uImageScale;
    uniform float uBumpiness;
    uniform float uBumpStrength;
    uniform float uHighlight;
    varying vec2 vUv;
    
    // Simple noise function
    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }
    
    // Smooth noise for glass texture
    float noise(vec2 st) {
      vec2 i = floor(st);
      vec2 f = fract(st);
      float a = random(i);
      float b = random(i + vec2(1.0, 0.0));
      float c = random(i + vec2(0.0, 1.0));
      float d = random(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
    
    void main() {
      // Apply zoom first (center the zoom)
      vec2 centeredUv = (vUv - 0.5) / uZoom + 0.5;
      
      // Apply offset for animation
      vec2 uv = centeredUv + uOffset;
      
      // Scale image to fill canvas while maintaining aspect ratio
      uv = (uv - 0.5) / uImageScale + 0.5;
      
      // Apply tiling
      if (uTiling) {
        uv = fract(uv);
      }
      
      if (!uEnabled) {
        vec4 color = texture2D(uTexture, uv);
        gl_FragColor = color;
        return;
      }
      
      // Create grid pattern based on screen UV (not offset UV)
      vec2 gridPos = floor(vUv / uSquareSize);
      vec2 localUv = fract(vUv / uSquareSize);
      
      // Add glass texture/bumpiness
      float bumpScale = mix(100.0, 10.0, uBumpiness); // Larger bumps = lower frequency
      float bumpNoise = noise(localUv * bumpScale + gridPos * 10.0);
      
      // Apply bumpiness to local UV to create texture with adjustable strength
      // Subtract 0.5 to center the noise around 0, reducing extreme dark/light areas
      vec2 bumpOffset = vec2(
        noise(localUv * bumpScale + vec2(1.0, 0.0)) - 0.5,
        noise(localUv * bumpScale + vec2(0.0, 1.0)) - 0.5
      ) * uBumpiness * uBumpStrength * 0.5; // Reduced multiplier from 1.0 to 0.5
      
      // Smooth the bump offset near edges to prevent harsh transitions
      vec2 edgeFade = smoothstep(0.0, 0.1, min(localUv, 1.0 - localUv));
      float edgeFadeFactor = min(edgeFade.x, edgeFade.y);
      bumpOffset *= edgeFadeFactor;
      
      // Create distortion based on position in square (with bumpiness)
      vec2 center = vec2(0.5);
      vec2 toCenter = (localUv + bumpOffset) - center;
      float distFromCenter = length(toCenter);
      
      // Simulate lens thickness profile (thicker at edges for rectangular prism)
      vec2 distFromEdge = min(localUv, 1.0 - localUv);
      float minDistFromEdge = min(distFromEdge.x, distFromEdge.y);
      
      // Lens magnification - stronger at edges where glass is thicker
      float lensStrength = exp(-minDistFromEdge * 8.0) * uMagnification;
      
      // Apply lens magnification (push away from center = magnify)
      vec2 magnifiedOffset = -toCenter * lensStrength * uSquareSize;
      
      // Apply refraction effect
      vec2 refractionOffset = toCenter * uDistortion * uRefraction * uSquareSize * 2.0;
      
      // Combine both effects with the moving UV
      vec2 distortedUv = uv + magnifiedOffset + refractionOffset;
      
      // Apply tiling to distorted UV
      if (uTiling) {
        distortedUv = fract(distortedUv);
      }
      
      // Add subtle color shifts for glass effect
      vec4 color = texture2D(uTexture, distortedUv);
      
      // Add glass highlights (pure additive overlay)
      if (uHighlight > 0.0) {
        vec3 highlightColor = vec3(1.0, 1.0, 1.05); // Subtle cool white tint
        
        // PART 1: Edge highlights (like light catching glass edges)
        // Calculate distance from edges (0 at edge, 0.5 at center)
        vec2 distFromEdge = min(localUv, 1.0 - localUv);
        float minEdgeDist = min(distFromEdge.x, distFromEdge.y);
        
        // Create thin edge highlight with smooth falloff
        float edgeMask = exp(-minEdgeDist * 20.0); // Sharp falloff from edges
        
        // Light direction simulation (top-left is brightest)
        float lightAngle = (1.0 - localUv.x) * (1.0 - localUv.y);
        
        // Edge highlight intensity (modulated by light direction)
        float edgeHighlight = edgeMask * lightAngle * uHighlight * 0.4;
        
        // PART 2: Broad diagonal gradient (simulates general illumination)
        vec2 fromTopLeft = localUv;
        float diagonalDist = length(fromTopLeft) / 1.414; // Normalize to 0-1
        
        // Smooth gradient from top-left corner
        float gradientIntensity = pow(1.0 - diagonalDist, 2.0) * uHighlight * 0.15;
        
        // PART 3: Subtle specular spots (like light reflections on bumpy glass)
        // Use the existing bump noise for variation
        float specular = bumpNoise * edgeMask * uHighlight * 0.2;
        
        // Combine all highlight components additively (never darkens)
        float totalHighlight = edgeHighlight + gradientIntensity + specular;
        
        // Apply as pure additive highlight - only adds light, never darkens
        color.rgb += highlightColor * totalHighlight;
      }
      
      gl_FragColor = vec4(color.rgb, uOpacity);
    }
  `,
};

function CrossFlutedPlane({
	imageUrl,
	squareSize,
	distortion,
	enabled,
	refraction,
	magnification,
	onRendererReady,
	animate,
	speed,
	direction,
	zoom,
	bumpiness,
	bumpStrength,
	highlight,
	frameWidth,
	frameHeight,
	imageOffset,
	onImageDrag,
}) {
	const meshRef = useRef();
	const { gl, camera, viewport } = useThree();
	const isDraggingRef = useRef(false);
	const lastMouseRef = useRef({ x: 0, y: 0 });

	useEffect(() => {
		if (gl && onRendererReady) {
			onRendererReady(gl);
		}
	}, [gl, onRendererReady]);

	const texture = useMemo(() => {
		if (!imageUrl) return null;
		const loader = new THREE.TextureLoader();
		const tex = loader.load(imageUrl);
		tex.wrapS = THREE.RepeatWrapping;
		tex.wrapT = THREE.RepeatWrapping;
		return tex;
	}, [imageUrl]);

	// Calculate scale to fill canvas while maintaining aspect ratio
	const { scale, imageAspect } = useMemo(() => {
		if (!texture?.image) return { scale: 1, imageAspect: 1 };

		const imgAspect = texture.image.width / texture.image.height;
		const canvasAspect = frameWidth / frameHeight;

		let scaleX, scaleY;
		if (imgAspect > canvasAspect) {
			// Image is wider - scale by height
			scaleY = 1;
			scaleX = canvasAspect / imgAspect;
		} else {
			// Image is taller - scale by width
			scaleX = 1;
			scaleY = imgAspect / canvasAspect;
		}

		return { scale: Math.min(scaleX, scaleY), imageAspect: imgAspect };
	}, [texture, frameWidth, frameHeight]);

	// Create uniforms once and store them in a ref so they persist
	const uniformsRef = useRef({
		uTexture: { value: null },
		uSquareSize: { value: squareSize },
		uDistortion: { value: distortion },
		uOpacity: { value: 1.0 },
		uEnabled: { value: enabled },
		uRefraction: { value: refraction },
		uMagnification: { value: 0.0 },
		uOffset: { value: new THREE.Vector2(0, 0) },
		uTiling: { value: false },
		uZoom: { value: 1.0 },
		uTime: { value: 0.0 },
		uImageScale: { value: 1.0 },
		uBumpiness: { value: 0.0 },
		uBumpStrength: { value: 0.1 },
		uHighlight: { value: 0.0 },
	});

	// Update texture when it changes
	useEffect(() => {
		if (texture && uniformsRef.current) {
			uniformsRef.current.uTexture.value = texture;
		}
	}, [texture]);

	// Update uniforms every frame
	useFrame((state) => {
		if (uniformsRef.current) {
			uniformsRef.current.uSquareSize.value = squareSize;
			uniformsRef.current.uDistortion.value = distortion;
			uniformsRef.current.uEnabled.value = enabled;
			uniformsRef.current.uRefraction.value = refraction;
			uniformsRef.current.uMagnification.value = magnification;
			uniformsRef.current.uTiling.value = animate;
			uniformsRef.current.uZoom.value = zoom;
			uniformsRef.current.uTime.value = state.clock.elapsedTime;
			uniformsRef.current.uImageScale.value = scale;
			uniformsRef.current.uBumpiness.value = bumpiness;
			uniformsRef.current.uBumpStrength.value = bumpStrength;
			uniformsRef.current.uHighlight.value = highlight;

			// Animate offset if animation is enabled

			// Animate offset if animation is enabled
			if (animate) {
				const time = state.clock.elapsedTime * speed * 0.1;
				const angle = (direction * Math.PI) / 180;
				uniformsRef.current.uOffset.value.x =
					Math.cos(angle) * time + imageOffset.x;
				uniformsRef.current.uOffset.value.y =
					Math.sin(angle) * time + imageOffset.y;
			} else {
				uniformsRef.current.uOffset.value.set(imageOffset.x, imageOffset.y);
			}
		}
	});

	const handlePointerDown = (event) => {
		event.stopPropagation();
		isDraggingRef.current = true;
		lastMouseRef.current = { x: event.point.x, y: event.point.y };
	};

	const handlePointerMove = (event) => {
		if (!isDraggingRef.current) return;
		event.stopPropagation();

		const deltaX = event.point.x - lastMouseRef.current.x;
		const deltaY = event.point.y - lastMouseRef.current.y;

		const aspect = frameWidth / frameHeight;
		onImageDrag(-deltaX / aspect, -deltaY);

		lastMouseRef.current = { x: event.point.x, y: event.point.y };
	};

	const handlePointerUp = () => {
		isDraggingRef.current = false;
	};

	if (!texture) return null;

	// Make plane fill the entire viewport
	const planeWidth = viewport.width;
	const planeHeight = viewport.height;

	return (
		<mesh
			ref={meshRef}
			position={[0, 0, 0]}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerLeave={handlePointerUp}
		>
			<planeGeometry args={[planeWidth, planeHeight, 32, 32]} />
			<shaderMaterial
				uniforms={uniformsRef.current}
				vertexShader={CrossFlutedShader.vertexShader}
				fragmentShader={CrossFlutedShader.fragmentShader}
				transparent={false}
			/>
		</mesh>
	);
}

export default CrossFlutedPlane;
