import React, { useRef, useState, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
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

// Aspect ratio presets
const ASPECT_RATIOS = {
	"1:1": { width: 1, height: 1, label: "Square" },
	"4:5": { width: 4, height: 5, label: "Portrait" },
	"9:16": { width: 9, height: 16, label: "Vertical" },
	"16:9": { width: 16, height: 9, label: "Landscape" },
	"4:3": { width: 4, height: 3, label: "Classic" },
};

const ORIENTATIONS = {
	landscape: "Landscape",
	portrait: "Portrait",
};

// Slider component with custom styling
function Slider({ label, value, min, max, step, onChange, unit = "" }) {
	const progress = ((value - min) / (max - min)) * 100;

	return (
		<div className="mb-4">
			<label className="text-sm text-[#a1a1a1] mb-2 flex flex-row">
				<span className="block w-full">{label}</span>
				<span className="block w-full text-right">
					{typeof value === "number" ? value.toFixed(2) : value}
					{unit}
				</span>
			</label>
			<div className="relative">
				<input
					type="range"
					min={min}
					max={max}
					step={step}
					value={value}
					onChange={(e) => onChange(parseFloat(e.target.value))}
					className="slider"
					style={{
						"--slider-progress": `${progress}%`,
					}}
				/>
			</div>
		</div>
	);
}

export default function App() {
	const [imageUrl, setImageUrl] = useState(null);
	const [squareSize, setSquareSize] = useState(0.05);
	const [distortion, setDistortion] = useState(0.15);
	const [enabled, setEnabled] = useState(true);
	const [refraction, setRefraction] = useState(0.5);
	const [magnification, setMagnification] = useState(0.3);
	const [animate, setAnimate] = useState(false);
	const [speed, setSpeed] = useState(1);
	const [direction, setDirection] = useState(0);
	const [zoom, setZoom] = useState(1);
	const [bumpiness, setBumpiness] = useState(0.5);
	const [bumpStrength, setBumpStrength] = useState(1.0);
	const [highlight, setHighlight] = useState(0.05);
	const [isRecording, setIsRecording] = useState(false);
	const [recordingDuration, setRecordingDuration] = useState(5);
	const [aspectRatio, setAspectRatio] = useState("16:9");
	const [orientation, setOrientation] = useState("landscape");
	const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
	const rendererRef = useRef();
	const mediaRecorderRef = useRef(null);
	const chunksRef = useRef([]);

	// Calculate frame dimensions based on aspect ratio and orientation
	const { frameWidth, frameHeight } = useMemo(() => {
		const ratio = ASPECT_RATIOS[aspectRatio];
		const isLandscape = orientation === "landscape";

		// Base resolution (can scale up for export)
		const baseSize = 1080;

		if (ratio.width === ratio.height) {
			// Square - orientation doesn't matter
			return { frameWidth: baseSize, frameHeight: baseSize };
		}

		if (isLandscape) {
			// Width is larger
			const width =
				ratio.width > ratio.height
					? baseSize
					: Math.round(baseSize * (ratio.width / ratio.height));
			const height =
				ratio.width > ratio.height
					? Math.round(baseSize * (ratio.height / ratio.width))
					: baseSize;
			return { frameWidth: width, frameHeight: height };
		} else {
			// Height is larger (portrait)
			const width =
				ratio.height > ratio.width
					? Math.round(baseSize * (ratio.width / ratio.height))
					: baseSize;
			const height =
				ratio.height > ratio.width
					? baseSize
					: Math.round(baseSize * (ratio.height / ratio.width));
			return { frameWidth: width, frameHeight: height };
		}
	}, [aspectRatio, orientation]);

	const handleImageDrag = (deltaX, deltaY) => {
		setImageOffset((prev) => ({
			x: prev.x + deltaX,
			y: prev.y + deltaY,
		}));
	};

	const resetAll = () => {
		setSquareSize(0.05);
		setDistortion(0.15);
		setEnabled(true);
		setRefraction(0.5);
		setMagnification(0.3);
		setAnimate(false);
		setSpeed(1);
		setDirection(0);
		setZoom(1);
		setBumpiness(0.5);
		setBumpStrength(0.1);
		setHighlight(0.3);
		setImageOffset({ x: 0, y: 0 });
	};

	const handleImageUpload = (e) => {
		const file = e.target.files[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = (event) => {
				setImageUrl(event.target.result);
			};
			reader.readAsDataURL(file);
		}
	};

	const startRecording = async () => {
		if (!rendererRef.current) return;

		try {
			const canvas = rendererRef.current.domElement;
			const stream = canvas.captureStream(60);

			const options = {
				mimeType: "video/webm;codecs=vp9",
				videoBitsPerSecond: 8000000,
			};

			if (!MediaRecorder.isTypeSupported(options.mimeType)) {
				options.mimeType = "video/webm;codecs=vp8";
			}

			mediaRecorderRef.current = new MediaRecorder(stream, options);
			chunksRef.current = [];

			mediaRecorderRef.current.ondataavailable = (e) => {
				if (e.data.size > 0) {
					chunksRef.current.push(e.data);
				}
			};

			mediaRecorderRef.current.onstop = async () => {
				const webmBlob = new Blob(chunksRef.current, { type: "video/webm" });
				const url = URL.createObjectURL(webmBlob);
				const link = document.createElement("a");
				link.href = url;
				link.download = "cross-fluted-animation.webm";
				link.click();
				URL.revokeObjectURL(url);
			};

			mediaRecorderRef.current.start();
			setIsRecording(true);

			setTimeout(() => {
				stopRecording();
			}, recordingDuration * 1000);
		} catch (error) {
			console.error("Recording failed:", error);
			alert("Recording failed. Please try again.");
		}
	};

	const stopRecording = () => {
		if (mediaRecorderRef.current && isRecording) {
			mediaRecorderRef.current.stop();
			setIsRecording(false);
		}
	};

	const handleDownload = (format) => {
		if (!rendererRef.current) return;

		try {
			const canvas = rendererRef.current.domElement;
			const link = document.createElement("a");
			link.download = `cross-fluted-glass.${format}`;
			link.href = canvas.toDataURL(`image/${format}`, 0.95);
			link.click();
		} catch (error) {
			console.error("Download failed:", error);
		}
	};

	return (
		<div className="bg-[#000000] overflow-y-auto overflow-x-hidden md:overflow-hidden">
			{/* nav  */}
			<div className="flex flex-row bg-[#0A0A0A] border-b border-1 border-[rgba(255,255,255,0.06)] h-14 px-4 w-full items-center justify-between">
				{/* logo */}
				<svg
					width="32"
					height="32"
					viewBox="0 0 32 32"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<title>Glass shader logo</title>
					<path
						d="M7.25 16.0996C8.47968 16.1917 9.41168 16.3691 10.2373 16.7109C12.5242 17.6582 14.3418 19.4758 15.2891 21.7627C15.6308 22.5881 15.8073 23.5199 15.8994 24.749C15.8544 25.0446 15.7917 25.2975 15.6953 25.5303C15.2893 26.5104 14.5104 27.2893 13.5303 27.6953C12.7952 27.9997 11.8635 28 10 28C8.1365 28 7.20476 27.9997 6.46973 27.6953C5.48961 27.2893 4.71066 26.5104 4.30469 25.5303C4.00034 24.7952 4 23.8635 4 22C4 20.1365 4.00034 19.2048 4.30469 18.4697C4.71066 17.4896 5.48961 16.7107 6.46973 16.3047C6.70228 16.2084 6.95476 16.1446 7.25 16.0996ZM24.749 16.0996C25.0447 16.1446 25.2975 16.2083 25.5303 16.3047C26.5104 16.7107 27.2893 17.4896 27.6953 18.4697C27.9997 19.2048 28 20.1365 28 22C28 23.8635 27.9997 24.7952 27.6953 25.5303C27.2893 26.5104 26.5104 27.2893 25.5303 27.6953C24.7952 27.9997 23.8635 28 22 28C20.1365 28 19.2048 27.9997 18.4697 27.6953C17.4896 27.2893 16.7107 26.5104 16.3047 25.5303C16.2083 25.2975 16.1446 25.0447 16.0996 24.749C16.1918 23.5198 16.3692 22.5881 16.7109 21.7627C17.6582 19.4758 19.4758 17.6582 21.7627 16.7109C22.5881 16.3692 23.5198 16.1918 24.749 16.0996ZM10 4C11.8635 4 12.7952 4.00034 13.5303 4.30469C14.5104 4.71066 15.2893 5.48961 15.6953 6.46973C15.7916 6.70224 15.8544 6.95483 15.8994 7.25C15.8073 8.47965 15.6309 9.4117 15.2891 10.2373C14.3418 12.5242 12.5242 14.3418 10.2373 15.2891C9.4117 15.6309 8.47965 15.8073 7.25 15.8994C6.95483 15.8544 6.70224 15.7916 6.46973 15.6953C5.48961 15.2893 4.71066 14.5104 4.30469 13.5303C4.00034 12.7952 4 11.8635 4 10C4 8.1365 4.00034 7.20476 4.30469 6.46973C4.71066 5.48961 5.48961 4.71066 6.46973 4.30469C7.20476 4.00034 8.1365 4 10 4ZM22 4C23.8635 4 24.7952 4.00034 25.5303 4.30469C26.5104 4.71066 27.2893 5.48961 27.6953 6.46973C27.9997 7.20476 28 8.1365 28 10C28 11.8635 27.9997 12.7952 27.6953 13.5303C27.2893 14.5104 26.5104 15.2893 25.5303 15.6953C25.2975 15.7917 25.0446 15.8544 24.749 15.8994C23.5199 15.8073 22.5881 15.6308 21.7627 15.2891C19.4758 14.3418 17.6582 12.5242 16.7109 10.2373C16.3691 9.41168 16.1917 8.47968 16.0996 7.25C16.1446 6.95476 16.2084 6.70228 16.3047 6.46973C16.7107 5.48961 17.4896 4.71066 18.4697 4.30469C19.2048 4.00034 20.1365 4 22 4Z"
						fill="#EDEDED"
					/>
				</svg>

				{/* actions */}
				<div className="flex flex-row gap-3 items-center">
					<button
						onClick={isRecording ? stopRecording : startRecording}
						disabled={!animate}
						className="flex flex-row items-center gap-2 border border-1 border-[#333] hover:bg-neutral-900/50 active:text-white/70 active:scale-[.98] transition-transform duration-100 ease text-white w-full px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer hover:shadow-[inset_0_5px_5px_0_rgba(255,255,255,0.05)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100 disabled:active:text-white/100"
					>
						<svg
							className="flex-shrink-0"
							width="16"
							height="16"
							viewBox="0 0 16 16"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<g clip-path="url(#clip0_15_375)">
								<g clip-path="url(#clip1_15_375)">
									<path
										d="M14 15V1H2V15H14Z"
										stroke="#EDEDED"
										stroke-width="1.5"
										stroke-linecap="round"
										stroke-linejoin="bevel"
									/>
									<path
										d="M5.6665 1.3335V14.6668"
										stroke="#EDEDED"
										stroke-width="1.33333"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
									<path
										d="M10.3335 1.3335V14.6668"
										stroke="#EDEDED"
										stroke-width="1.33333"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
									<path
										d="M2.3335 8H13.6635"
										stroke="#EDEDED"
										stroke-width="1.33333"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
									<path
										d="M2.3335 4.6665H5.66683"
										stroke="#EDEDED"
										stroke-width="1.33333"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
									<path
										d="M2.3335 11.3335H5.66683"
										stroke="#EDEDED"
										stroke-width="1.33333"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
									<path
										d="M10.3335 11.3335H13.6668"
										stroke="#EDEDED"
										stroke-width="1.33333"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
									<path
										d="M10.3335 4.6665H13.6668"
										stroke="#EDEDED"
										stroke-width="1.33333"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</g>
							</g>
							<defs>
								<clipPath id="clip0_15_375">
									<rect width="16" height="16" fill="white" />
								</clipPath>
								<clipPath id="clip1_15_375">
									<rect width="16" height="16" fill="white" />
								</clipPath>
							</defs>
						</svg>

						{isRecording ? `Recording...` : "Record"}
					</button>
					<button
						onClick={() => handleDownload("png")}
						className="flex flex-row items-center gap-2 bg-[#0080FF] border border-1 border-[#3098FF] hover:opacity-90 active:text-white/70 active:scale-[.98] transition-transform duration-100 ease text-white w-full px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer shadow-[inset_0_4px_4px_0_rgba(255,255,255,0.15)]"
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 16 16"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<g clip-path="url(#clip0_15_444)">
								<path
									d="M15 2H1V14H15V2Z"
									stroke="#EDEDED"
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="bevel"
								/>
								<path
									d="M4.6665 6.6665C5.21879 6.6665 5.6665 6.21879 5.6665 5.6665C5.6665 5.11422 5.21879 4.6665 4.6665 4.6665C4.11422 4.6665 3.6665 5.11422 3.6665 5.6665C3.6665 6.21879 4.11422 6.6665 4.6665 6.6665Z"
									stroke="#EDEDED"
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="bevel"
								/>
								<path
									d="M14.5 11L10.6663 6.6665L3.33301 13.9998"
									stroke="#EDEDED"
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="bevel"
								/>
							</g>
							<defs>
								<clipPath id="clip0_15_444">
									<rect width="16" height="16" fill="white" />
								</clipPath>
							</defs>
						</svg>
						Capture
					</button>
				</div>
			</div>
			<div
				style={{
					width: "100vw",
					height: "calc(100vh - 56px)",
					display: "flex",
				}}
				className="flex flex-col md:flex-row"
			>
				{/* controls */}
				<div className="flex flex-col gap-4 bg-[#0A0A0A] p-4 overflow-y-auto flex-shrink-0 w-full md:w-80 scrollbar">
					<div className="w-full">
						<h2 className="text-sm text-[#EDEDED] mb-2">Image</h2>
						<label className="block text-center border border-1 border-[#333] hover:bg-neutral-900/50 hover:opacity-90 active:text-white/70 active:scale-[.98] transition-transform duration-100 ease text-white w-full px-3 py-1.5 h-10 content-center rounded-lg text-sm font-medium cursor-pointer w-full hover:shadow-[inset_0_5px_5px_0_rgba(255,255,255,0.05)]">
							Upload
							<input
								type="file"
								accept="image/*"
								onChange={handleImageUpload}
								style={{ display: "none" }}
							/>
						</label>
					</div>

					{imageUrl && (
						<>
							<div className="flex flex-col gap-2">
								<div className="flex flex-col gap-2">
									<label className="text-sm text-[#a1a1a1]">Aspect Ratio</label>
									<select
										value={aspectRatio}
										onChange={(e) => setAspectRatio(e.target.value)}
										className="w-full bg-transparent border border-1 border-[#333] text-[#ededed] h-10 px-3 py-1.5 rounded-lg text-sm cursor-pointer"
									>
										{Object.entries(ASPECT_RATIOS).map(([key, { label }]) => (
											<option key={key} value={key}>
												{key} – {label}
											</option>
										))}
									</select>
								</div>
							</div>

							<Slider
								label="Zoom"
								value={zoom}
								min={0.5}
								max={5}
								step={0.1}
								onChange={setZoom}
								unit="x"
							/>

							{/* effect */}
							<div className="mt-3">
								<div className="flex flex-row items-center justify-between mb-3">
									<h3 className="text-sm text-[#EDEDED]">Effect</h3>
									<div className="flex flex-row items-center justify-between gap-4">
										<button onClick={resetAll}>
											<svg
												width="16"
												height="16"
												viewBox="0 0 16 16"
												fill="none"
												xmlns="http://www.w3.org/2000/svg"
											>
												<g opacity="0.7">
													<path
														d="M4.6665 0.666504L1.99984 3.33317L4.6665 5.99984"
														stroke="#EDEDED"
														stroke-width="1.5"
														stroke-linejoin="bevel"
													/>
													<path
														d="M14 7.3335V6.00016C14 5.29292 14 3.3335 14 3.3335C14 3.3335 12.0406 3.3335 11.3333 3.3335H2"
														stroke="#EDEDED"
														stroke-width="1.5"
														stroke-linejoin="bevel"
													/>
													<path
														d="M11.3333 15.3333L14 12.6667L11.3333 10"
														stroke="#EDEDED"
														stroke-width="1.5"
														stroke-linejoin="bevel"
													/>
													<path
														d="M2 8.6665V9.99984C2 10.7071 2 12.6665 2 12.6665C2 12.6665 3.95942 12.6665 4.66667 12.6665H14"
														stroke="#EDEDED"
														stroke-width="1.5"
														stroke-linejoin="bevel"
													/>
												</g>
											</svg>
										</button>
										<label className="toggle-switch">
											<input
												aria-label="Enable Effect"
												type="checkbox"
												checked={enabled}
												onChange={(e) => setEnabled(e.target.checked)}
											/>
											<span className="toggle-slider"></span>
										</label>
									</div>
								</div>

								<Slider
									label="Square Size"
									value={squareSize}
									min={0.005}
									max={0.2}
									step={0.005}
									onChange={setSquareSize}
								/>

								<Slider
									label="Distortion"
									value={distortion}
									min={0}
									max={0.5}
									step={0.01}
									onChange={setDistortion}
								/>

								<Slider
									label="Refraction"
									value={refraction}
									min={0}
									max={5}
									step={0.1}
									onChange={setRefraction}
								/>

								<Slider
									label="Magnification"
									value={magnification}
									min={0}
									max={10}
									step={0.05}
									onChange={setMagnification}
								/>

								<Slider
									label="Glass Highlights"
									value={highlight}
									min={0}
									max={1}
									step={0.01}
									onChange={setHighlight}
								/>
								<Slider
									label="Glass Texture"
									value={bumpiness}
									min={0}
									max={1}
									step={0.01}
									onChange={setBumpiness}
								/>

								<Slider
									label="Texture Strength"
									value={bumpStrength}
									min={0}
									max={5}
									step={0.01}
									onChange={setBumpStrength}
								/>
							</div>

							{/* motion */}
							<div className="flex flex-col mt-3">
								<div className="flex flex-row items-center justify-between mb-3">
									<h3 className="text-sm text-[#EDEDED]">Motion</h3>

									<label className="toggle-switch">
										<input
											aria-label="Enable motion"
											type="checkbox"
											checked={animate}
											onChange={(e) => setAnimate(e.target.checked)}
										/>
										<span className="toggle-slider"></span>
									</label>
								</div>

								{animate && (
									<>
										<Slider
											label="Speed"
											value={speed}
											min={0.1}
											max={5}
											step={0.1}
											onChange={setSpeed}
											unit="x"
										/>

										<div className="mb-4">
											<label className="text-sm text-[#a1a1a1] mb-2 flex flex-row">
												Direction
												<span className="block w-full text-right">
													{direction}°
												</span>
											</label>
											<div className="relative">
												<input
													type="range"
													min="0"
													max="360"
													step="15"
													value={direction}
													onChange={(e) =>
														setDirection(parseFloat(e.target.value))
													}
													className="slider"
												/>
											</div>
											<div
												style={{
													display: "flex",
													justifyContent: "space-between",
													fontSize: "11px",
													opacity: 0.6,
													marginTop: "8px",
												}}
											>
												<span>→ Right</span>
												<span>↑ Up</span>
												<span>← Left</span>
												<span>↓ Down</span>
											</div>
										</div>
									</>
								)}
							</div>
						</>
					)}

					{!imageUrl && (
						<p className="text-sm opacity-60 my-auto text-center">
							Upload an image to get started
						</p>
					)}
				</div>

				{/* canvas */}
				<div
					style={{
						flex: 1,
						alignItems: "center",
						justifyContent: "center",
					}}
					className="flex p-4 -order-1 md:order-1"
				>
					<div
						style={{
							width: "100%",
							height: "100%",
							maxWidth: `min(calc(100vw - 400px), calc((100vh - 40px) * ${
								frameWidth / frameHeight
							}))`,
							maxHeight: `min(calc(100vh - 40px), calc((100vw - 360px) * ${
								frameHeight / frameWidth
							}))`,
							aspectRatio: `${frameWidth} / ${frameHeight}`,
							background: "#000",
						}}
						className="shadow-[0_0_0_1px_rgba(255,255,255,0.1)]"
					>
						<Canvas
							camera={{ position: [0, 0, 5], fov: 75 }}
							gl={{
								preserveDrawingBuffer: true,
								alpha: false,
								antialias: true,
							}}
							style={{
								width: "100%",
								height: "100%",
								display: "block",
							}}
							onCreated={({ gl }) => {
								gl.setSize(frameWidth, frameHeight);
								rendererRef.current = gl;
							}}
						>
							<color attach="background" args={["#000000"]} />
							{imageUrl && (
								<CrossFlutedPlane
									imageUrl={imageUrl}
									squareSize={squareSize}
									distortion={distortion}
									enabled={enabled}
									refraction={refraction}
									magnification={magnification}
									onRendererReady={(gl) => (rendererRef.current = gl)}
									animate={animate}
									speed={speed}
									direction={direction}
									zoom={zoom}
									bumpiness={bumpiness}
									bumpStrength={bumpStrength}
									highlight={highlight}
									frameWidth={frameWidth}
									frameHeight={frameHeight}
									imageOffset={imageOffset}
									onImageDrag={handleImageDrag}
								/>
							)}
						</Canvas>
					</div>
				</div>
			</div>
		</div>
	);
}
