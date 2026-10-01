import React, { useRef, useMemo, useEffect, useState } from "react";
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
    uniform vec2 uAspectCorrection;
    uniform float uAspect; // frame width / height
    uniform float uBumpiness;
    uniform float uBumpStrength;
    uniform float uHighlight;
    uniform float uPattern; // 0 = squares, 1 = stripes
    varying vec2 vUv;

    // Sine-free hash - avoids the banding/precision artifacts of fract(sin(...))
    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
      float a = hash12(i);
      float b = hash12(i + vec2(1.0, 0.0));
      float c = hash12(i + vec2(0.0, 1.0));
      float d = hash12(i + vec2(1.0, 1.0));
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    float fbm(vec2 p) {
      return noise(p) * 0.65 + noise(p * 2.03 + 17.1) * 0.35;
    }

    // Slope of a hammered/frosted micro-surface (finite differences of fbm)
    vec2 bumpSlope(vec2 p) {
      float e = 0.2;
      float h = fbm(p);
      return vec2(fbm(p + vec2(e, 0.0)) - h, fbm(p + vec2(0.0, e)) - h) / e;
    }

    // Per-pixel rotation for the blur kernel - turns banding into fine grain
    float interleavedNoise(vec2 p) {
      return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
    }

    // Cross-section of one flute: a circular arc, nearly flat in the middle
    // and steep at the seams. That curvature change is what reads as glass -
    // the image stays clear through the middle and compresses at the edges.
    float fluteSlope(float t) {
      float s = (t - 0.5) * 1.96;
      return -(s * 0.35 + 0.65 * s / sqrt(1.0 - s * s)) * 0.5;
    }

    // Snell refraction of a straight-on view ray through surface normal n.
    // Returns the lateral shift per unit of glass thickness.
    vec2 refractShift(vec3 n, float ior) {
      vec3 t = refract(vec3(0.0, 0.0, -1.0), n, 1.0 / ior);
      return t.xy / max(-t.z, 0.2);
    }

    vec2 wrapUv(vec2 p) {
      return uTiling ? fract(p) : p;
    }

    // Blurred, chromatically split sample. Offsets and radius are in texture UV.
    vec3 sampleGlass(vec2 uv, vec2 offR, vec2 offG, vec2 offB, vec2 radius) {
      float rot = interleavedNoise(gl_FragCoord.xy) * 6.2831853;
      vec3 acc = vec3(0.0);
      for (int i = 0; i < 8; i++) {
        float fi = float(i);
        float a = fi * 2.3999632 + rot; // golden angle spiral
        vec2 d = vec2(cos(a), sin(a)) * sqrt((fi + 0.5) / 8.0) * radius;
        acc.r += texture2D(uTexture, wrapUv(uv + offR + d)).r;
        acc.g += texture2D(uTexture, wrapUv(uv + offG + d)).g;
        acc.b += texture2D(uTexture, wrapUv(uv + offB + d)).b;
      }
      return acc / 8.0;
    }

    const vec3 LIGHT = vec3(-0.5, 0.6, 0.62); // top-left key light (normalized)

    float fresnel(vec3 n) {
      return 0.04 + 0.96 * pow(1.0 - clamp(n.z, 0.0, 1.0), 5.0);
    }

    // Half vector projected into the plane a flute curves in, so every flute
    // catches a long streak (like a softbox) instead of a single point
    float specular(vec3 n, vec3 halfVector) {
      float nh = max(dot(n, normalize(halfVector)), 0.0);
      return pow(nh, 900.0) * 0.28 + pow(nh, 60.0) * 0.05;
    }

    // Light the glass from its two faces (front flutes run one way, back flutes
    // the other): gentle body shading, a studio reflection at grazing angles
    // (Fresnel) and a thin specular streak along each flute
    vec3 shadeGlass(vec3 color, vec3 front, vec3 back, float h) {
      // Faces tilted toward the light brighten, faces away darken
      color *= 1.0 + (dot(front, LIGHT) + dot(back, LIGHT) - 2.0 * LIGHT.z) * h * 0.45;

      vec3 R = reflect(vec3(0.0, 0.0, -1.0), normalize(front + back));
      vec3 env = vec3(mix(0.02, 1.0, smoothstep(-0.2, 0.9, R.y * 0.8 - R.x * 0.5)));
      float f = max(fresnel(front), fresnel(back)) - 0.04;
      color = mix(color, env, clamp(f * h * 0.9, 0.0, 1.0));

      vec3 H = LIGHT + vec3(0.0, 0.0, 1.0);
      float spec = specular(front, vec3(H.x, 0.0, H.z))
        + specular(back, vec3(0.0, H.y, H.z)) * step(0.001, 1.0 - back.z);
      color += vec3(1.0, 1.0, 1.03) * spec * h;
      return color;
    }

    void main() {
      // Apply zoom first (center the zoom)
      vec2 centeredUv = (vUv - 0.5) / uZoom + 0.5;

      // Apply offset for animation
      vec2 uv = centeredUv + uOffset;

      // Correct for aspect ratio difference (maintains image proportions)
      uv = (uv - 0.5) * uAspectCorrection + 0.5;

      if (!uEnabled) {
        gl_FragColor = texture2D(uTexture, wrapUv(uv));
        return;
      }

      bool isStripes = uPattern == 1.0;

      // Frame space: y spans 0..1, x spans 0..aspect, so cells stay square
      vec2 frame = vUv * vec2(uAspect, 1.0);
      // Converts a frame-space distance into a texture UV distance
      vec2 frameToUv = uAspectCorrection / (uZoom * vec2(uAspect, 1.0));

      // Frosted / hammered micro texture shared by every pattern
      float bumpAmount = uBumpiness * uBumpStrength;
      float bumpFreq = mix(140.0, 25.0, uBumpiness);
      vec2 microSlope = bumpSlope(frame * bumpFreq) * bumpAmount * 0.12;

      float depth = uDistortion * 8.0;
      float ior = 1.0 + uRefraction * 0.5; // default 0.8 -> 1.4, close to real glass
      float lensPull = 1.0 - 1.0 / (1.0 + uMagnification * 0.25);

      // Stripes: only segment along X, so the flutes run as continuous vertical rods
      vec2 cellCoord = frame / uSquareSize;
      vec2 local = fract(cellCoord);

      // Cross-fluted glass is flutes on both axes, so the slopes simply add
      vec2 fluteSlopes = depth * vec2(fluteSlope(local.x), fluteSlope(local.y));
      vec2 toCenter = (local - 0.5) * uSquareSize;
      if (isStripes) {
        fluteSlopes.y = 0.0;
        toCenter.y = 0.0;
      }
      // Each flute acts as a lens over the image behind it
      vec2 lensOffset = -toCenter * lensPull; // frame space
      float thickness = uSquareSize * 0.7;  // frame space

      // Antialiased valley line between flutes, about 1.5px wide
      vec2 seamPx = min(local, 1.0 - local) / max(fwidth(cellCoord), vec2(1e-5));
      float seamDist = isStripes ? seamPx.x : min(seamPx.x, seamPx.y);
      float seam = 1.0 - smoothstep(0.0, 1.5, seamDist);

      vec3 n = normalize(vec3(-fluteSlopes, 1.0));

      // Dispersion: red bends a little less than blue, so colors fringe at steep edges
      float iorR = 1.0 + (ior - 1.0) * 0.93;
      float iorB = 1.0 + (ior - 1.0) * 1.07;
      // The micro texture is a thin surface layer, so it shifts the image by a
      // fixed small amount instead of scaling with the flute thickness
      vec2 shared = lensOffset - microSlope * (ior - 1.0) * 0.012;
      vec2 offR = (refractShift(n, iorR) * thickness + shared) * frameToUv;
      vec2 offG = (refractShift(n, ior) * thickness + shared) * frameToUv;
      vec2 offB = (refractShift(n, iorB) * thickness + shared) * frameToUv;

      // Light scatters more where the glass is steep, plus overall frost from the texture
      float steep = smoothstep(0.6, 3.0, length(fluteSlopes));
      float blurFrame = bumpAmount * 0.002 + steep * thickness * 0.12;
      vec3 color = sampleGlass(uv, offR, offG, offB, blurFrame * frameToUv);

      // Front face carries the vertical flutes, back face the horizontal ones
      // (flat for stripes). The micro texture only refracts and frosts,
      // so it doesn't break up the highlight streaks.
      vec3 front = normalize(vec3(-fluteSlopes.x, 0.0, 1.0));
      vec3 back = normalize(vec3(0.0, -fluteSlopes.y, 1.0));
      color = shadeGlass(color, front, back, uHighlight);

      // The valley between flutes catches no light
      color *= 1.0 - seam * 0.6 * clamp(uHighlight * 1.5, 0.0, 1.0);

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), uOpacity);
    }
  `,
};

const PATTERN_VALUES = {
	squares: 0,
	stripes: 1,
};

function CrossFlutedPlane({
	imageUrl,
	isVideo = false,
	videoElement = null,
	pattern = "squares",
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
	const videoTextureRef = useRef(null);
	const [textureLoaded, setTextureLoaded] = useState(false);

	useEffect(() => {
		if (gl && onRendererReady) {
			onRendererReady(gl);
		}
	}, [gl, onRendererReady]);

	const texture = useMemo(() => {
		if (!imageUrl) return null;

		// Handle video texture
		if (isVideo && videoElement) {
			// Make sure video has loaded metadata
			if (!videoElement.videoWidth || !videoElement.videoHeight) {
				console.log("Video not ready yet");
				return null;
			}

			console.log(
				"Creating NEW video texture:",
				videoElement.videoWidth,
				"x",
				videoElement.videoHeight,
				"for src:",
				videoElement.src.substring(0, 50)
			);

			const videoTexture = new THREE.VideoTexture(videoElement);
			videoTexture.wrapS = THREE.RepeatWrapping;
			videoTexture.wrapT = THREE.RepeatWrapping;
			videoTexture.minFilter = THREE.LinearFilter;
			videoTexture.magFilter = THREE.LinearFilter;
			videoTexture.format = THREE.RGBAFormat;
			videoTexture.needsUpdate = true;

			// Store in ref AND return it
			videoTextureRef.current = videoTexture;
			console.log("Video texture created and stored");
			return videoTexture;
		}

		// Handle image texture
		setTextureLoaded(false);
		const loader = new THREE.TextureLoader();
		const tex = loader.load(imageUrl, () => {
			// Image loaded - trigger re-render for aspect correction
			setTextureLoaded(true);
		});
		tex.wrapS = THREE.RepeatWrapping;
		tex.wrapT = THREE.RepeatWrapping;
		return tex;
	}, [imageUrl, isVideo, videoElement]);

	// Clean up textures when they change
	useEffect(() => {
		// Store the current texture to clean up later
		const currentTexture = texture;

		return () => {
			if (currentTexture && isVideo) {
				console.log("Cleaning up old video texture");
				currentTexture.dispose();
			}
		};
	}, [texture, isVideo]);

	// Clean up video texture on unmount
	useEffect(() => {
		return () => {
			if (videoTextureRef.current) {
				videoTextureRef.current.dispose();
				videoTextureRef.current = null;
			}
		};
	}, []);

	// Calculate aspect correction to maintain image proportions
	const aspectCorrection = useMemo(() => {
		if (!texture?.image) return { x: 1, y: 1 };

		const imgWidth =
			isVideo && videoElement ? videoElement.videoWidth : texture.image.width;
		const imgHeight =
			isVideo && videoElement ? videoElement.videoHeight : texture.image.height;

		if (!imgWidth || !imgHeight) return { x: 1, y: 1 };

		const imgAspect = imgWidth / imgHeight;
		const canvasAspect = frameWidth / frameHeight;

		// Adjust UVs so image maintains its proportions
		if (imgAspect > canvasAspect) {
			// Image is wider than frame - crop top/bottom (adjust Y)
			return { x: 1, y: imgAspect / canvasAspect };
		} else {
			// Image is narrower than frame - crop left/right (adjust X)
			return { x: canvasAspect / imgAspect, y: 1 };
		}
	}, [texture, frameWidth, frameHeight, isVideo, videoElement, textureLoaded]);

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
		uAspectCorrection: { value: new THREE.Vector2(1, 1) },
		uAspect: { value: frameWidth / frameHeight },
		uBumpiness: { value: 0.0 },
		uBumpStrength: { value: 0.1 },
		uHighlight: { value: 0.0 },
		uPattern: { value: PATTERN_VALUES[pattern] ?? 0 },
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
			// Update video texture if needed - ALWAYS update for video textures
			if (isVideo && texture) {
				// Update the texture that's actually in the uniform
				texture.needsUpdate = true;
			}

			uniformsRef.current.uSquareSize.value = squareSize;
			uniformsRef.current.uDistortion.value = distortion;
			uniformsRef.current.uEnabled.value = enabled;
			uniformsRef.current.uRefraction.value = refraction;
			uniformsRef.current.uMagnification.value = magnification;
			uniformsRef.current.uTiling.value = animate;
			uniformsRef.current.uZoom.value = zoom;
			uniformsRef.current.uTime.value = state.clock.elapsedTime;
			uniformsRef.current.uAspectCorrection.value.set(aspectCorrection.x, aspectCorrection.y);
			uniformsRef.current.uAspect.value = frameWidth / frameHeight;
			uniformsRef.current.uBumpiness.value = bumpiness;
			uniformsRef.current.uBumpStrength.value = bumpStrength;
			uniformsRef.current.uHighlight.value = highlight;
			uniformsRef.current.uPattern.value = PATTERN_VALUES[pattern] ?? 0;

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
