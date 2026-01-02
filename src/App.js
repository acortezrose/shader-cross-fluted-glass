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
      vec2 bumpOffset = vec2(
        noise(localUv * bumpScale + vec2(1.0, 0.0)) - 0.5,
        noise(localUv * bumpScale + vec2(0.0, 1.0)) - 0.5
      ) * uBumpiness * uBumpStrength;
      
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
      
      // Create depth effect at edges (darker where glass is thicker)
      float edge = smoothstep(0.0, 0.15, minDistFromEdge);
      
      // Mix with brightness variation based on glass thickness
      float brightness = mix(0.85, 1.05, edge);
      color.rgb *= brightness;
      
      // Add glass highlights
      if (uHighlight > 0.0) {
        vec3 highlightColor = vec3(1.2, 1.2, 1.25); // Brighter for more visible highlights
        
        // PART 1: Inner border highlight (more prominent)
        // Calculate distance from edges (0 at edge, 0.5 at center)
        vec2 distFromEdge = min(localUv, 1.0 - localUv);
        float minEdgeDist = min(distFromEdge.x, distFromEdge.y);
        
        // Create thin inner border (visible in first ~0.1 from edge, sharper falloff)
        float borderMask = 1.0 - smoothstep(0.0, 0.1, minEdgeDist);
        borderMask = pow(borderMask, 0.5); // Make it more visible
        
        // Calculate position along diagonal (0 = top-left, 1 = bottom-right)
        float diagonalPos = (localUv.x + localUv.y) / 2.0;
        
        // Border brightness: brightest at top-left, darkest in middle, medium-bright at bottom-right
        float borderBrightness;
        if (diagonalPos < 0.5) {
          // Top-left to middle: fade from bright to dark
          borderBrightness = mix(1.0, 0.2, diagonalPos * 2.0);
        } else {
          // Middle to bottom-right: fade from dark to medium-bright
          borderBrightness = mix(0.2, 0.6, (diagonalPos - 0.5) * 2.0);
        }
        
        float borderHighlight = borderMask * borderBrightness * uHighlight * 0.6;
        
        // PART 2: Gradient fill overlay (additive, not darkening)
        // Diagonal gradient from top-left to bottom-right
        vec2 fromTopLeft = localUv;
        float diagonalDist = length(fromTopLeft) / 1.414; // Normalize to 0-1
        
        // Gradient fades from top-left to bottom-right
        float gradientIntensity = pow(1.0 - diagonalDist, 1.5) * uHighlight * 0.25;
        
        // Apply border highlight (mix with white)
        color.rgb = mix(color.rgb, highlightColor, borderHighlight);
        
        // Apply gradient overlay (additive for true highlighting)
        color.rgb += highlightColor * gradientIntensity;
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
	const [bumpStrength, setBumpStrength] = useState(0.1);
	const [highlight, setHighlight] = useState(0.3);
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
		<div
			style={{
				width: "100vw",
				height: "100vh",
				background: "#1a1a1a",
				display: "flex",
			}}
		>
			<div
				style={{
					width: "320px",
					background: "rgba(0,0,0,0.9)",
					padding: "20px",
					color: "white",
					overflowY: "auto",
					flexShrink: 0,
				}}
				className="flex flex-col gap-4"
			>
				<h1>Cross-Fluted Glass Effect</h1>

				<div className="w-full">
					<label className="block text-center bg-neutral-800 hover:bg-neutral-800/70 hover:scale-[1.02] active:text-white/70 active:scale-[.98] transition-transform duration-150 ease text-white w-full px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer shadow-[inset_0_5px_5px_0_rgba(255,255,255,0.05)] w-full">
						Upload Image
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
						<div style={{ marginBottom: "15px" }}>
							<button
								onClick={resetAll}
								className="bg-neutral-800 hover:bg-neutral-800/70 hover:scale-[1.02] active:text-white/70 active:scale-[.98] transition-transform duration-150 ease text-white w-full px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer shadow-[inset_0_5px_5px_0_rgba(255,255,255,0.05)]"
							>
								Reset
							</button>
						</div>

						<div className="flex flex-col gap-2">
							<h3 className="text-sm opacity-60">Frame</h3>

							<div className="flex flex-col gap-1">
								<label
									style={{
										display: "block",
										marginBottom: "5px",
										fontSize: "14px",
									}}
								>
									Aspect Ratio
								</label>
								<select
									value={aspectRatio}
									onChange={(e) => setAspectRatio(e.target.value)}
									style={{
										width: "100%",
										padding: "8px",
										background: "#2a2a2a",
										border: "1px solid #444",
										borderRadius: "5px",
										color: "white",
										fontSize: "14px",
										cursor: "pointer",
									}}
								>
									{Object.entries(ASPECT_RATIOS).map(([key, { label }]) => (
										<option key={key} value={key}>
											{key} - {label}
										</option>
									))}
								</select>
							</div>

							<div
								style={{
									padding: "10px",
									background: "#2a2a2a",
									borderRadius: "5px",
									fontSize: "13px",
								}}
							>
								Export Size: {frameWidth} × {frameHeight}px
							</div>
						</div>

						<div>
							<h3 className="text-sm opacity-60">Effect</h3>
							<div style={{ marginBottom: "15px" }}>
								<label
									style={{
										display: "flex",
										alignItems: "center",
										gap: "10px",
										cursor: "pointer",
									}}
								>
									<input
										type="checkbox"
										checked={enabled}
										onChange={(e) => setEnabled(e.target.checked)}
										style={{ cursor: "pointer" }}
									/>
									<span>Enable Effect</span>
								</label>
							</div>

							<div style={{ marginBottom: "15px" }}>
								<label
									style={{
										display: "block",
										marginBottom: "5px",
										fontSize: "14px",
									}}
								>
									Square Size: {squareSize.toFixed(3)}
								</label>
								<input
									type="range"
									min="0.005"
									max="0.2"
									step="0.005"
									value={squareSize}
									onChange={(e) => setSquareSize(parseFloat(e.target.value))}
									style={{ width: "100%" }}
								/>
							</div>

							<div style={{ marginBottom: "15px" }}>
								<label
									style={{
										display: "block",
										marginBottom: "5px",
										fontSize: "14px",
									}}
								>
									Distortion: {distortion.toFixed(2)}
								</label>
								<input
									type="range"
									min="0"
									max="0.5"
									step="0.01"
									value={distortion}
									onChange={(e) => setDistortion(parseFloat(e.target.value))}
									style={{ width: "100%" }}
								/>
							</div>

							<div style={{ marginBottom: "15px" }}>
								<label
									style={{
										display: "block",
										marginBottom: "5px",
										fontSize: "14px",
									}}
								>
									Refraction: {refraction.toFixed(2)}
								</label>
								<input
									type="range"
									min="0"
									max="5"
									step="0.1"
									value={refraction}
									onChange={(e) => setRefraction(parseFloat(e.target.value))}
									style={{ width: "100%" }}
								/>
							</div>

							<div style={{ marginBottom: "15px" }}>
								<label
									style={{
										display: "block",
										marginBottom: "5px",
										fontSize: "14px",
									}}
								>
									Magnification: {magnification.toFixed(2)}
								</label>
								<input
									type="range"
									min="0"
									max="10"
									step="0.05"
									value={magnification}
									onChange={(e) => setMagnification(parseFloat(e.target.value))}
									style={{ width: "100%" }}
								/>
							</div>

							<div style={{ marginBottom: "15px" }}>
								<label
									style={{
										display: "block",
										marginBottom: "5px",
										fontSize: "14px",
									}}
								>
									Zoom: {zoom.toFixed(2)}x
								</label>
								<input
									type="range"
									min="0.5"
									max="5"
									step="0.1"
									value={zoom}
									onChange={(e) => setZoom(parseFloat(e.target.value))}
									style={{ width: "100%" }}
								/>
							</div>

							<div style={{ marginBottom: "15px" }}>
								<label
									style={{
										display: "block",
										marginBottom: "5px",
										fontSize: "14px",
									}}
								>
									Glass Texture: {bumpiness.toFixed(2)}
								</label>
								<input
									type="range"
									min="0"
									max="1"
									step="0.01"
									value={bumpiness}
									onChange={(e) => setBumpiness(parseFloat(e.target.value))}
									style={{ width: "100%" }}
								/>
								<div
									style={{
										display: "flex",
										justifyContent: "space-between",
										fontSize: "11px",
										opacity: 0.6,
										marginTop: "3px",
									}}
								>
									<span>Smooth</span>
									<span>Frosted</span>
									<span>Bumpy</span>
								</div>
							</div>

							<div style={{ marginBottom: "15px" }}>
								<label
									style={{
										display: "block",
										marginBottom: "5px",
										fontSize: "14px",
									}}
								>
									Texture Strength: {bumpStrength.toFixed(2)}
								</label>
								<input
									type="range"
									min="0"
									max="5"
									step="0.01"
									value={bumpStrength}
									onChange={(e) => setBumpStrength(parseFloat(e.target.value))}
									style={{ width: "100%" }}
								/>
							</div>

							<div style={{ marginBottom: "15px" }}>
								<label
									style={{
										display: "block",
										marginBottom: "5px",
										fontSize: "14px",
									}}
								>
									Glass Highlights: {highlight.toFixed(2)}
								</label>
								<input
									type="range"
									min="0"
									max="1"
									step="0.01"
									value={highlight}
									onChange={(e) => setHighlight(parseFloat(e.target.value))}
									style={{ width: "100%" }}
								/>
							</div>
						</div>

						<div
							style={{
								marginBottom: "15px",
								paddingTop: "15px",
								borderTop: "1px solid rgba(255,255,255,0.2)",
							}}
						>
							<h3 className="text-sm opacity-60">Motion</h3>

							<div>
								<label
									style={{
										display: "flex",
										alignItems: "center",
										gap: "10px",
										cursor: "pointer",
									}}
								>
									<input
										type="checkbox"
										checked={animate}
										onChange={(e) => setAnimate(e.target.checked)}
										style={{ cursor: "pointer" }}
									/>
									<span>Enable Motion</span>
								</label>
							</div>

							{animate && (
								<>
									<div style={{ marginBottom: "15px" }}>
										<label
											style={{
												display: "block",
												marginBottom: "5px",
												fontSize: "14px",
											}}
										>
											Speed: {speed.toFixed(1)}x
										</label>
										<input
											type="range"
											min="0.1"
											max="5"
											step="0.1"
											value={speed}
											onChange={(e) => setSpeed(parseFloat(e.target.value))}
											style={{ width: "100%" }}
										/>
									</div>

									<div style={{ marginBottom: "15px" }}>
										<label
											style={{
												display: "block",
												marginBottom: "5px",
												fontSize: "14px",
											}}
										>
											Direction: {direction}°
										</label>
										<input
											type="range"
											min="0"
											max="360"
											step="15"
											value={direction}
											onChange={(e) => setDirection(parseFloat(e.target.value))}
											style={{ width: "100%" }}
										/>
										<div
											style={{
												display: "flex",
												justifyContent: "space-between",
												fontSize: "12px",
												opacity: 0.7,
												marginTop: "5px",
											}}
										>
											<span>→ Right</span>
											<span>↑ Up</span>
											<span>← Left</span>
											<span>↓ Down</span>
										</div>
									</div>

									<button
										onClick={isRecording ? stopRecording : startRecording}
										disabled={!animate}
										className="bg-neutral-800 hover:bg-neutral-800/70 hover:scale-[1.02] active:text-white/70 active:scale-[.98] transition-transform duration-150 ease text-white w-full px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer shadow-[inset_0_5px_5px_0_rgba(255,255,255,0.05)]"
									>
										{isRecording ? `Recording...` : "Record Video (WebM)"}
									</button>
								</>
							)}
						</div>

						<div
							style={{
								marginTop: "20px",
								paddingTop: "15px",
								borderTop: "1px solid rgba(255,255,255,0.2)",
							}}
						>
							<h3 style={{ margin: "0 0 15px 0", fontSize: "16px" }}>
								Export Static Image
							</h3>
							<div style={{ display: "flex", gap: "10px" }}>
								<button
									onClick={() => handleDownload("png")}
									className="bg-neutral-800 hover:bg-neutral-800/70 hover:scale-[1.02] active:text-white/70 active:scale-[.98] transition-transform duration-150 ease text-white w-full px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer shadow-[inset_0_5px_5px_0_rgba(255,255,255,0.05)]"
								>
									Download PNG
								</button>
								<button
									onClick={() => handleDownload("jpeg")}
									className="bg-neutral-800 hover:bg-neutral-800/70 hover:scale-[1.02] active:text-white/70 active:scale-[.98] transition-transform duration-150 ease text-white w-full px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer shadow-[inset_0_5px_5px_0_rgba(255,255,255,0.05)]"
								>
									Download JPG
								</button>
							</div>
						</div>
					</>
				)}

				{!imageUrl && (
					<p className="text-sm opacity-60 my-auto text-center">
						Upload an image to get started
					</p>
				)}
			</div>

			<div
				style={{
					flex: 1,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					padding: "20px",
					background: "#0a0a0a",
				}}
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
						border: "2px solid #333",
					}}
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
	);
}
