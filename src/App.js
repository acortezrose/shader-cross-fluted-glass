import { useRef, useState, useMemo, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import CrossFlutedPlane from "./components/CrossFlutedPlane";
import Controls from "./components/Controls";
import { Seek } from "./components/Slider";
import { Analytics } from "@vercel/analytics/react";

const ASPECT_RATIOS = {
	"1:1": { width: 1, height: 1, label: "Square" },
	"4:5": { width: 4, height: 5, label: "Portrait" },
	"9:16": { width: 9, height: 16, label: "Vertical" },
	"16:9": { width: 16, height: 9, label: "Landscape" },
	"4:3": { width: 4, height: 3, label: "Classic" },
};

export default function App() {
	const rendererRef = useRef();
	const mediaRecorderRef = useRef(null);
	const chunksRef = useRef([]);
	const videoRef = useRef(null);

	const [config, setConfig] = useState({
		imageUrl: null,
		isVideo: false,
		videoReady: false,
		isPlaying: false,
		currentTime: 0,
		duration: 0,
		isLoading: false,
		squareSize: 0.05,
		distortion: 0.15,
		enabled: true,
		refraction: 0.5,
		magnification: 0.3,
		animate: false,
		speed: 1,
		direction: 0,
		zoom: 1,
		bumpiness: 0.05,
		bumpStrength: 1.0,
		highlight: 0.05,
		isRecording: false,
		recordingDuration: 5,
		aspectRatio: "16:9",
		orientation: "landscape",
		imageOffset: { x: 0, y: 0 },
	});

	// Handle video loading
	useEffect(() => {
		if (config.isVideo && videoRef.current && config.imageUrl) {
			const video = videoRef.current;

			// Reset videoReady when new video loads
			setConfig((prev) => ({ ...prev, videoReady: false }));

			const handleLoadedData = () => {
				console.log("Video loaded:", video.videoWidth, "x", video.videoHeight);
				setConfig((prev) => ({
					...prev,
					videoReady: true,
					duration: video.duration,
					isPlaying: true,
					isLoading: false,
				}));
			};

			const handleError = (e) => {
				console.error("Video error:", e);
			};

			const handleTimeUpdate = () => {
				// Only log occasionally to avoid spam
				if (Math.floor(video.currentTime) % 1 === 0) {
					console.log(
						"Video time update:",
						video.currentTime,
						"paused:",
						video.paused
					);
				}
				setConfig((prev) => ({ ...prev, currentTime: video.currentTime }));
			};

			const handlePlay = () => {
				console.log("Video PLAY event fired");
				setConfig((prev) => ({ ...prev, isPlaying: true }));
			};

			const handlePause = () => {
				console.log("Video PAUSE event fired");
				setConfig((prev) => ({ ...prev, isPlaying: false }));
			};

			const handleEnded = () => {
				setConfig((prev) => ({ ...prev, isPlaying: false }));
			};

			video.addEventListener("loadeddata", handleLoadedData);
			video.addEventListener("error", handleError);
			video.addEventListener("timeupdate", handleTimeUpdate);
			video.addEventListener("play", handlePlay);
			video.addEventListener("pause", handlePause);
			video.addEventListener("ended", handleEnded);

			// Force play if not already playing
			video.play().catch((err) => console.error("Play error:", err));

			return () => {
				video.removeEventListener("loadeddata", handleLoadedData);
				video.removeEventListener("error", handleError);
				video.removeEventListener("timeupdate", handleTimeUpdate);
				video.removeEventListener("play", handlePlay);
				video.removeEventListener("pause", handlePause);
				video.removeEventListener("ended", handleEnded);
			};
		} else if (!config.isVideo) {
			setConfig((prev) => ({
				...prev,
				videoReady: false,
				currentTime: 0,
				duration: 0,
			}));
		}
	}, [config.isVideo, config.imageUrl]);

	// Calculate frame dimensions based on aspect ratio and orientation
	const { frameWidth, frameHeight } = useMemo(() => {
		const ratio = ASPECT_RATIOS[config.aspectRatio];
		const isLandscape = config.orientation === "landscape";

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
	}, [config.aspectRatio, config.orientation]);

	const handleImageDrag = (deltaX, deltaY) => {
		setConfig((prev) => ({
			...prev,
			imageOffset: {
				x: prev.imageOffset.x + deltaX,
				y: prev.imageOffset.y + deltaY,
			},
		}));
	};

	const togglePlayPause = () => {
		console.log("Toggle play/pause clicked", {
			hasVideoRef: !!videoRef.current,
			isPlaying: config.isPlaying,
		});

		if (videoRef.current) {
			if (config.isPlaying) {
				console.log("Pausing video");
				videoRef.current.pause();
			} else {
				console.log("Playing video");
				videoRef.current.play().catch((err) => {
					console.error("Play error:", err);
				});
			}
		} else {
			console.error("No video ref available");
		}
	};

	const handleSeek = (e) => {
		if (videoRef.current) {
			const value = parseFloat(e.target.value);
			videoRef.current.currentTime = value;
			setConfig((prev) => ({ ...prev, currentTime: value }));
		}
	};

	const formatTime = (seconds) => {
		if (!seconds || isNaN(seconds)) return "0:00";
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
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
			setConfig((prev) => ({ ...prev, isRecording: true }));

			setTimeout(() => {
				stopRecording();
			}, config.recordingDuration * 1000);
		} catch (error) {
			console.error("Recording failed:", error);
			alert("Recording failed. Please try again.");
		}
	};

	const stopRecording = () => {
		if (mediaRecorderRef.current && config.isRecording) {
			mediaRecorderRef.current.stop();
			setConfig((prev) => ({ ...prev, isRecording: false }));
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
			{/* Hidden video element for video textures */}
			{config.isVideo && config.imageUrl && (
				<video
					key={config.imageUrl}
					ref={videoRef}
					src={config.imageUrl}
					loop
					muted
					playsInline
					style={{ display: "none" }}
					crossOrigin="anonymous"
				/>
			)}

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
						disabled={!config.animate && !config.isVideo}
						onClick={config.isRecording ? stopRecording : startRecording}
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
							<g clipPath="url(#clip0_15_375)">
								<g clipPath="url(#clip1_15_375)">
									<path
										d="M14 15V1H2V15H14Z"
										stroke="#EDEDED"
										strokeWidth="1.5"
										strokeLinecap="round"
										strokeLinejoin="bevel"
									/>
									<path
										d="M5.6665 1.3335V14.6668"
										stroke="#EDEDED"
										strokeWidth="1.33333"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
									<path
										d="M10.3335 1.3335V14.6668"
										stroke="#EDEDED"
										strokeWidth="1.33333"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
									<path
										d="M2.3335 8H13.6635"
										stroke="#EDEDED"
										strokeWidth="1.33333"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
									<path
										d="M2.3335 4.6665H5.66683"
										stroke="#EDEDED"
										strokeWidth="1.33333"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
									<path
										d="M2.3335 11.3335H5.66683"
										stroke="#EDEDED"
										strokeWidth="1.33333"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
									<path
										d="M10.3335 11.3335H13.6668"
										stroke="#EDEDED"
										strokeWidth="1.33333"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
									<path
										d="M10.3335 4.6665H13.6668"
										stroke="#EDEDED"
										strokeWidth="1.33333"
										strokeLinecap="round"
										strokeLinejoin="round"
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

						{config.isRecording ? `Recording...` : "Record"}
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
							<g clipPath="url(#clip0_15_444)">
								<path
									d="M15 2H1V14H15V2Z"
									stroke="#EDEDED"
									strokeWidth="1.5"
									strokeLinecap="round"
									strokeLinejoin="bevel"
								/>
								<path
									d="M4.6665 6.6665C5.21879 6.6665 5.6665 6.21879 5.6665 5.6665C5.6665 5.11422 5.21879 4.6665 4.6665 4.6665C4.11422 4.6665 3.6665 5.11422 3.6665 5.6665C3.6665 6.21879 4.11422 6.6665 4.6665 6.6665Z"
									stroke="#EDEDED"
									strokeWidth="1.5"
									strokeLinecap="round"
									strokeLinejoin="bevel"
								/>
								<path
									d="M14.5 11L10.6663 6.6665L3.33301 13.9998"
									stroke="#EDEDED"
									strokeWidth="1.5"
									strokeLinecap="round"
									strokeLinejoin="bevel"
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
				<Controls
					imageUrl={config.imageUrl}
					config={config}
					setConfig={setConfig}
					ASPECT_RATIOS={ASPECT_RATIOS}
				/>

				{/* canvas */}
				<div
					style={{
						flex: 1,
						alignItems: "center",
						justifyContent: "center",
					}}
					className="canvas flex p-4 -order-1 md:order-1 flex-col"
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
						className="shadow-[0_0_0_1px_rgba(255,255,255,0.1)] relative overflow-hidden"
					>
						{/* Loading skeleton */}
						{config.isLoading ? (
							<div className="absolute inset-0 flex items-center justify-center bg-[#0A0A0A]">
								<div className="relative w-full h-full">
									{/* Animated gradient bars */}

									<div
										className="h-full bg-gradient-to-r from-[#1a1a1a] via-[#252525] to-[#1a1a1a] animate-pulse"
										style={{
											animationDuration: "1.5s",
										}}
									/>

									{/* Center text */}
									<div className="absolute inset-0 flex items-center justify-center">
										<div className="flex flex-col items-center gap-3 backdrop-blur-sm px-6 py-4">
											<p className="text-sm text-[#A1A1A1]">Loading...</p>
										</div>
									</div>
								</div>
							</div>
						) : (
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
								{config.imageUrl && (!config.isVideo || config.videoReady) && (
									<CrossFlutedPlane
										imageUrl={config.imageUrl}
										isVideo={config.isVideo}
										videoElement={videoRef.current}
										squareSize={config.squareSize}
										distortion={config.distortion}
										enabled={config.enabled}
										refraction={config.refraction}
										magnification={config.magnification}
										onRendererReady={(gl) => (rendererRef.current = gl)}
										animate={config.animate}
										speed={config.speed}
										direction={config.direction}
										zoom={config.zoom}
										bumpiness={config.bumpiness}
										bumpStrength={config.bumpStrength}
										highlight={config.highlight}
										frameWidth={frameWidth}
										frameHeight={frameHeight}
										imageOffset={config.imageOffset}
										onImageDrag={handleImageDrag}
									/>
								)}
							</Canvas>
						)}
						{/* Video controls */}
						{config.isVideo && config.videoReady && (
							<div className="absolute bottom-4 w-full p-4 video-controls">
								<div className="mx-auto max-w-sm flex flex-row items-center gap-2 ">
									{/* Play/Pause button */}
									<button
										onClick={togglePlayPause}
										className="bg-[#0a0a0a]/50 border border-1 border-[#333]/40 shrink-0 w-10 h-10 hover:bg-neutral-900/50 active:scale-[.98] transition-transform duration-100 ease rounded-lg flex justify-center items-center cursor-pointer hover:shadow-[inset_0_5px_5px_0_rgba(255,255,255,0.05)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100 disabled:active:text-white/100"
										aria-label={config.isPlaying ? "Pause" : "Play"}
									>
										{config.isPlaying ? (
											<svg
												width="16"
												height="16"
												viewBox="0 0 16 16"
												fill="none"
												xmlns="http://www.w3.org/2000/svg"
											>
												<path
													d="M5.91699 3.4165V12.5835H4.75V3.4165H5.91699Z"
													stroke="#EDEDED"
													stroke-width="1.5"
													stroke-linecap="round"
													stroke-linejoin="bevel"
												/>
												<path
													d="M11.2505 3.4165V12.5835H10.0835V3.4165H11.2505Z"
													stroke="#EDEDED"
													stroke-width="1.5"
													stroke-linecap="round"
													stroke-linejoin="bevel"
												/>
											</svg>
										) : (
											<svg
												width="16"
												height="16"
												viewBox="0 0 16 16"
												fill="none"
												xmlns="http://www.w3.org/2000/svg"
											>
												<path
													d="M11.2793 8L4.08301 12.626V3.37305L11.2793 8Z"
													stroke="#EDEDED"
													fill="#EDEDED"
													stroke-width="1.5"
													stroke-linecap="round"
													stroke-linejoin="bevel"
												/>
											</svg>
										)}
									</button>
									<div className="flex flex-row items-center gap-3 w-full bg-[#0A0A0A]/50 rounded-xl p-4 py-3 border border-[#333]/40">
										{/* Time display */}
										<span className="text-xs text-[#A1A1A1] flex-shrink-0">
											{formatTime(config.currentTime)}{" "}
										</span>

										{/* Seek bar */}
										{/* <input
											type="range"
											min="0"
											max={config.duration || 0}
											step="0.1"
											value={config.currentTime}
											onChange={handleSeek}
											className="w-full seek"
										/> */}
										<Seek
											config={config}
											setConfig={setConfig}
											videoRef={videoRef}
										/>

										{/* Duration */}
										<span className="text-xs text-[#A1A1A1] flex-shrink-0 text-right">
											{formatTime(config.duration)}
										</span>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
			<Analytics />
		</div>
	);
}
