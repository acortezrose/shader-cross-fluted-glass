import { useState } from "react";
import Slider from "./Slider";

function Controls({ config, setConfig, ASPECT_RATIOS }) {
	const [isDragging, setIsDragging] = useState(false);

	const resetAll = () => {
		setConfig((prev) => ({
			...prev,
			squareSize: 0.05,
			distortion: 0.15,
			enabled: true,
			refraction: 0.5,
			magnification: 0.3,
			animate: false,
			speed: 1,
			direction: 0,
			zoom: 1,
			bumpiness: 0.5,
			bumpStrength: 0.1,
			highlight: 0.3,
		}));
	};

	const handleMediaUpload = (e) => {
		const file = e.target.files[0];
		if (file) {
			processFile(file);
		}
	};

	const processFile = (file) => {
		// Set loading state immediately
		setConfig((prev) => ({ ...prev, isLoading: true }));

		const reader = new FileReader();
		reader.onload = (event) => {
			setConfig((prev) => ({
				...prev,
				imageUrl: event.target.result,
				isVideo: file.type.startsWith("video/"),
				// For images, loading is done immediately; for videos, wait for video load event
				isLoading: file.type.startsWith("video/"),
			}));
		};
		reader.readAsDataURL(file);
	};

	const handleDragEnter = (e) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
	};

	const handleDragLeave = (e) => {
		e.preventDefault();
		e.stopPropagation();
		if (e.currentTarget === e.target) {
			setIsDragging(false);
		}
	};

	const handleDragOver = (e) => {
		e.preventDefault();
		e.stopPropagation();
	};

	const handleDrop = (e) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);

		const file = e.dataTransfer.files[0];
		if (
			file &&
			(file.type.startsWith("image/") || file.type.startsWith("video/"))
		) {
			processFile(file);
		}
	};

	return (
		<div className="flex flex-col gap-4 bg-[#0A0A0A] p-4 overflow-y-auto flex-shrink-0 w-full md:w-80 scrollbar">
			{config.imageUrl && (
				<>
					<div className="w-full">
						<h2 className="text-sm text-[#EDEDED] mb-2">Media</h2>
						<label className="block text-center border border-1 border-[#333] hover:bg-neutral-900/50 hover:opacity-90 active:text-white/70 active:scale-[.98] transition-transform duration-100 ease text-white w-full px-3 py-1.5 h-10 content-center rounded-lg text-sm font-medium cursor-pointer w-full hover:shadow-[inset_0_5px_5px_0_rgba(255,255,255,0.05)]">
							Upload
							<input
								type="file"
								accept="image/*,video/*"
								onChange={handleMediaUpload}
								style={{ display: "none" }}
							/>
						</label>
					</div>
					<div className="flex flex-col gap-2">
						<div className="flex flex-col gap-2">
							<label className="text-sm text-[#a1a1a1]">Aspect Ratio</label>
							<select
								value={config.aspectRatio}
								onChange={(e) =>
									setConfig((prev) => ({
										...prev,
										aspectRatio: e.target.value,
									}))
								}
								className="w-full bg-transparent border border-1 border-[#333] text-[#ededed] h-10 px-3 py-1.5 rounded-lg text-sm cursor-pointer appearance-none"
								style={{
									backgroundImage: `url("data:image/svg+xml,%3Csvg className='opacity-60' width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cg clip-path='url(%23clip0_15_340)'%3E%3Cpath d='M8 10L11 6H5L8 10Z' fill='%23EDEDED' stroke='%23EDEDED' stroke-width='1.5'/%3E%3C/g%3E%3Cdefs%3E%3CclipPath id='clip0_15_340'%3E%3Crect width='16' height='16' fill='white'/%3E%3C/clipPath%3E%3C/defs%3E%3C/svg%3E")`,
									backgroundRepeat: "no-repeat",
									backgroundPosition: "right 0.75rem center",
									backgroundSize: "16px 16px",
								}}
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
						value={config.zoom}
						min={0.5}
						max={5}
						step={0.1}
						onChange={(val) => setConfig((prev) => ({ ...prev, zoom: val }))}
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
												strokeWidth="1.5"
												strokeLinejoin="bevel"
											/>
											<path
												d="M14 7.3335V6.00016C14 5.29292 14 3.3335 14 3.3335C14 3.3335 12.0406 3.3335 11.3333 3.3335H2"
												stroke="#EDEDED"
												strokeWidth="1.5"
												strokeLinejoin="bevel"
											/>
											<path
												d="M11.3333 15.3333L14 12.6667L11.3333 10"
												stroke="#EDEDED"
												strokeWidth="1.5"
												strokeLinejoin="bevel"
											/>
											<path
												d="M2 8.6665V9.99984C2 10.7071 2 12.6665 2 12.6665C2 12.6665 3.95942 12.6665 4.66667 12.6665H14"
												stroke="#EDEDED"
												strokeWidth="1.5"
												strokeLinejoin="bevel"
											/>
										</g>
									</svg>
								</button>
								<label className="toggle-switch">
									<input
										aria-label="Enable Effect"
										type="checkbox"
										checked={config.enabled}
										onChange={(e) =>
											setConfig((prev) => ({
												...prev,
												enabled: e.target.checked,
											}))
										}
									/>
									<span className="toggle-slider"></span>
								</label>
							</div>
						</div>

						<Slider
							label="Square Size"
							value={config.squareSize}
							min={0.005}
							max={1}
							step={0.005}
							onChange={(val) =>
								setConfig((prev) => ({ ...prev, squareSize: val }))
							}
						/>

						<Slider
							label="Distortion"
							value={config.distortion}
							min={0}
							max={0.5}
							step={0.01}
							onChange={(val) =>
								setConfig((prev) => ({ ...prev, distortion: val }))
							}
						/>

						<Slider
							label="Refraction"
							value={config.refraction}
							min={0}
							max={5}
							step={0.1}
							onChange={(val) =>
								setConfig((prev) => ({ ...prev, refraction: val }))
							}
						/>

						<Slider
							label="Magnification"
							value={config.magnification}
							min={0}
							max={10}
							step={0.05}
							onChange={(val) =>
								setConfig((prev) => ({ ...prev, magnification: val }))
							}
						/>

						<Slider
							label="Glass Highlights"
							value={config.highlight}
							min={0}
							max={1}
							step={0.01}
							onChange={(val) =>
								setConfig((prev) => ({ ...prev, highlight: val }))
							}
						/>
						<Slider
							label="Glass Texture"
							value={config.bumpiness}
							min={0}
							max={1}
							step={0.01}
							onChange={(val) =>
								setConfig((prev) => ({
									...prev,
									bumpiness: val,
								}))
							}
						/>

						<Slider
							label="Texture Strength"
							value={config.bumpStrength}
							min={0}
							max={5}
							step={0.01}
							onChange={(val) =>
								setConfig((prev) => ({
									...prev,
									bumpStrength: val,
								}))
							}
						/>
					</div>

					{/* motion */}
					<div className="flex flex-col mt-3">
						<div className="flex flex-row items-center justify-between mb-3">
							<h3 className="text-sm text-[#EDEDED]">Pan</h3>

							<label className="toggle-switch">
								<input
									aria-label="Enable panning"
									type="checkbox"
									checked={config.animate}
									onChange={(e) =>
										setConfig((prev) => ({
											...prev,
											animate: e.target.checked,
										}))
									}
								/>
								<span className="toggle-slider"></span>
							</label>
						</div>

						{config.animate && (
							<>
								<Slider
									label="Speed"
									value={config.speed}
									min={0.1}
									max={5}
									step={0.1}
									onChange={(val) =>
										setConfig((prev) => ({
											...prev,
											speed: val,
										}))
									}
									unit="x"
								/>

								<Slider
									label="Direction"
									value={config.direction}
									min={0.1}
									max={5}
									step={0.1}
									onChange={(val) =>
										setConfig((prev) => ({
											...prev,
											direction: parseFloat(val),
										}))
									}
									unit="x"
								/>
							</>
						)}
					</div>
				</>
			)}

			{!config.imageUrl && (
				<div
					className={`text-center flex flex-col gap-0 justify-center items-center flex-grow -mx-4 -my-[16px] px-4 py-4.5 ${
						isDragging ? "bg-neutral-900/40" : ""
					}`}
					onDragEnter={handleDragEnter}
					onDragLeave={handleDragLeave}
					onDragOver={handleDragOver}
					onDrop={handleDrop}
				>
					<svg
						width="195"
						height="168"
						viewBox="0 0 195 168"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
						style={{
							transform: isDragging ? "skewY(5deg)" : "skewY(0deg)",
							transformOrigin: "bottom center",
							transition: "transform 0.3s cubic-bezier(.165, .84, .44, 1)",
						}}
					>
						<g filter="url(#filter0_i_36_471)">
							<path
								d="M36.999 55.9929C36.999 50.2625 41.6444 45.6172 47.3747 45.6172H75.6071C78.5035 45.6172 81.3021 46.6648 83.4866 48.5666L88.6287 53.0434C90.8132 54.9453 93.6119 55.9929 96.5083 55.9929H146.999C153.626 55.9929 158.999 61.3655 158.999 67.9929V129.617C158.999 136.245 153.626 141.617 146.999 141.617H48.999C42.3716 141.617 36.999 136.245 36.999 129.617V55.9929Z"
								fill="#212121"
							/>
						</g>
						<g filter="url(#filter1_ddiii_36_471)">
							<rect
								x="44.2012"
								y="65.8633"
								width="109"
								height="67"
								rx="4"
								transform="rotate(2 44.2012 65.8633)"
								fill="#D9D9D9"
							/>
						</g>
						<g filter="url(#filter2_diii_36_471)">
							<rect
								x="42.4229"
								y="68.7012"
								width="109"
								height="67"
								rx="4"
								transform="rotate(-1 42.4229 68.7012)"
								fill="#D9D9D9"
							/>
						</g>
						<g
							filter="url(#filter3_ii_36_471)"
							style={{
								transform: isDragging ? "skewX(-15deg)" : "skewX(0deg)",
								transformOrigin: "bottom center",
								transition: "transform 0.3s cubic-bezier(.165, .84, .44, 1)",
							}}
						>
							<rect
								x="36.999"
								y="61.6172"
								width="122"
								height="80"
								rx="12"
								fill="#242424"
							/>
							<g filter="url(#filter4_ii_36_471)">
								<path
									d="M89.249 101.717C90.4787 101.809 91.4107 101.986 92.2363 102.328C94.5233 103.275 96.3408 105.093 97.2881 107.38C97.6298 108.205 97.8063 109.137 97.8984 110.366C97.8534 110.662 97.7907 110.915 97.6943 111.147C97.2884 112.128 96.5094 112.907 95.5293 113.312C94.7943 113.617 93.8625 113.617 91.999 113.617C90.1355 113.617 89.2038 113.617 88.4688 113.312C87.4886 112.907 86.7097 112.128 86.3037 111.147C85.9994 110.412 85.999 109.481 85.999 107.617C85.999 105.754 85.9994 104.822 86.3037 104.087C86.7097 103.107 87.4886 102.328 88.4688 101.922C88.7013 101.826 88.9538 101.762 89.249 101.717ZM106.748 101.717C107.044 101.762 107.296 101.825 107.529 101.922C108.509 102.328 109.288 103.107 109.694 104.087C109.999 104.822 109.999 105.754 109.999 107.617C109.999 109.481 109.999 110.412 109.694 111.147C109.288 112.128 108.509 112.907 107.529 113.312C106.794 113.617 105.863 113.617 103.999 113.617C102.136 113.617 101.204 113.617 100.469 113.312C99.4886 112.907 98.7097 112.128 98.3037 111.147C98.2073 110.915 98.1436 110.662 98.0986 110.366C98.1908 109.137 98.3682 108.205 98.71 107.38C99.6572 105.093 101.475 103.275 103.762 102.328C104.587 101.986 105.519 101.809 106.748 101.717ZM91.999 89.6172C93.8625 89.6172 94.7943 89.6175 95.5293 89.9219C96.5094 90.3279 97.2884 91.1068 97.6943 92.0869C97.7906 92.3194 97.8534 92.572 97.8984 92.8672C97.8063 94.0968 97.6299 95.0289 97.2881 95.8545C96.3408 98.1414 94.5233 99.959 92.2363 100.906C91.4107 101.248 90.4787 101.424 89.249 101.517C88.9539 101.472 88.7013 101.409 88.4688 101.312C87.4886 100.907 86.7097 100.128 86.3037 99.1475C85.9994 98.4124 85.999 97.4807 85.999 95.6172C85.999 93.7537 85.9994 92.8219 86.3037 92.0869C86.7097 91.1068 87.4886 90.3279 88.4688 89.9219C89.2038 89.6175 90.1355 89.6172 91.999 89.6172ZM103.999 89.6172C105.863 89.6172 106.794 89.6175 107.529 89.9219C108.509 90.3279 109.288 91.1068 109.694 92.0869C109.999 92.8219 109.999 93.7537 109.999 95.6172C109.999 97.4807 109.999 98.4124 109.694 99.1475C109.288 100.128 108.509 100.907 107.529 101.312C107.297 101.409 107.044 101.472 106.748 101.517C105.519 101.424 104.587 101.248 103.762 100.906C101.475 99.959 99.6572 98.1414 98.71 95.8545C98.3681 95.0289 98.1908 94.0969 98.0986 92.8672C98.1436 92.572 98.2074 92.3195 98.3037 92.0869C98.7097 91.1068 99.4886 90.3279 100.469 89.9219C101.204 89.6175 102.136 89.6172 103.999 89.6172Z"
									fill="#1F1F1F"
								/>
							</g>
						</g>
						<defs>
							<filter
								id="filter0_i_36_471"
								x="36.999"
								y="45.6172"
								width="122"
								height="97"
								filterUnits="userSpaceOnUse"
								colorInterpolationFilters="sRGB"
							>
								<feFlood floodOpacity="0" result="BackgroundImageFix" />
								<feBlend
									mode="normal"
									in="SourceGraphic"
									in2="BackgroundImageFix"
									result="shape"
								/>
								<feColorMatrix
									in="SourceAlpha"
									type="matrix"
									values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
									result="hardAlpha"
								/>
								<feOffset dy="1" />
								<feGaussianBlur stdDeviation="0.5" />
								<feComposite
									in2="hardAlpha"
									operator="arithmetic"
									k2="-1"
									k3="1"
								/>
								<feColorMatrix
									type="matrix"
									values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.03 0"
								/>
								<feBlend
									mode="normal"
									in2="shape"
									result="effect1_innerShadow_36_471"
								/>
							</filter>
							<filter
								id="filter1_ddiii_36_471"
								x="0"
								y="0"
								width="194.998"
								height="154.489"
								filterUnits="userSpaceOnUse"
								colorInterpolationFilters="sRGB"
							>
								<feFlood floodOpacity="0" result="BackgroundImageFix" />
								<feColorMatrix
									in="SourceAlpha"
									type="matrix"
									values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
									result="hardAlpha"
								/>
								<feOffset dy="-12" />
								<feGaussianBlur stdDeviation="6" />
								<feComposite in2="hardAlpha" operator="out" />
								<feColorMatrix
									type="matrix"
									values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.15 0"
								/>
								<feBlend
									mode="normal"
									in2="BackgroundImageFix"
									result="effect1_dropShadow_36_471"
								/>
								<feColorMatrix
									in="SourceAlpha"
									type="matrix"
									values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
									result="hardAlpha"
								/>
								<feOffset dy="-24" />
								<feGaussianBlur stdDeviation="21" />
								<feComposite in2="hardAlpha" operator="out" />
								<feColorMatrix
									type="matrix"
									values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0"
								/>
								<feBlend
									mode="normal"
									in2="effect1_dropShadow_36_471"
									result="effect2_dropShadow_36_471"
								/>
								<feBlend
									mode="normal"
									in="SourceGraphic"
									in2="effect2_dropShadow_36_471"
									result="shape"
								/>
								<feColorMatrix
									in="SourceAlpha"
									type="matrix"
									values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
									result="hardAlpha"
								/>
								<feOffset />
								<feGaussianBlur stdDeviation="4" />
								<feComposite
									in2="hardAlpha"
									operator="arithmetic"
									k2="-1"
									k3="1"
								/>
								<feColorMatrix
									type="matrix"
									values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.5 0"
								/>
								<feBlend
									mode="normal"
									in2="shape"
									result="effect3_innerShadow_36_471"
								/>
								<feColorMatrix
									in="SourceAlpha"
									type="matrix"
									values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
									result="hardAlpha"
								/>
								<feOffset dy="4" />
								<feGaussianBlur stdDeviation="2" />
								<feComposite
									in2="hardAlpha"
									operator="arithmetic"
									k2="-1"
									k3="1"
								/>
								<feColorMatrix
									type="matrix"
									values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.8 0"
								/>
								<feBlend
									mode="normal"
									in2="effect3_innerShadow_36_471"
									result="effect4_innerShadow_36_471"
								/>
								<feColorMatrix
									in="SourceAlpha"
									type="matrix"
									values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
									result="hardAlpha"
								/>
								<feOffset dy="1" />
								<feGaussianBlur stdDeviation="0.5" />
								<feComposite
									in2="hardAlpha"
									operator="arithmetic"
									k2="-1"
									k3="1"
								/>
								<feColorMatrix
									type="matrix"
									values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
								/>
								<feBlend
									mode="normal"
									in2="effect4_innerShadow_36_471"
									result="effect5_innerShadow_36_471"
								/>
							</filter>
							<filter
								id="filter2_diii_36_471"
								x="0.492188"
								y="0.868164"
								width="194.014"
								height="152.754"
								filterUnits="userSpaceOnUse"
								colorInterpolationFilters="sRGB"
							>
								<feFlood floodOpacity="0" result="BackgroundImageFix" />
								<feColorMatrix
									in="SourceAlpha"
									type="matrix"
									values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
									result="hardAlpha"
								/>
								<feOffset dy="-24" />
								<feGaussianBlur stdDeviation="21" />
								<feComposite in2="hardAlpha" operator="out" />
								<feColorMatrix
									type="matrix"
									values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0"
								/>
								<feBlend
									mode="normal"
									in2="BackgroundImageFix"
									result="effect1_dropShadow_36_471"
								/>
								<feBlend
									mode="normal"
									in="SourceGraphic"
									in2="effect1_dropShadow_36_471"
									result="shape"
								/>
								<feColorMatrix
									in="SourceAlpha"
									type="matrix"
									values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
									result="hardAlpha"
								/>
								<feOffset />
								<feGaussianBlur stdDeviation="4" />
								<feComposite
									in2="hardAlpha"
									operator="arithmetic"
									k2="-1"
									k3="1"
								/>
								<feColorMatrix
									type="matrix"
									values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.5 0"
								/>
								<feBlend
									mode="normal"
									in2="shape"
									result="effect2_innerShadow_36_471"
								/>
								<feColorMatrix
									in="SourceAlpha"
									type="matrix"
									values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
									result="hardAlpha"
								/>
								<feOffset dy="4" />
								<feGaussianBlur stdDeviation="2" />
								<feComposite
									in2="hardAlpha"
									operator="arithmetic"
									k2="-1"
									k3="1"
								/>
								<feColorMatrix
									type="matrix"
									values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.8 0"
								/>
								<feBlend
									mode="normal"
									in2="effect2_innerShadow_36_471"
									result="effect3_innerShadow_36_471"
								/>
								<feColorMatrix
									in="SourceAlpha"
									type="matrix"
									values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
									result="hardAlpha"
								/>
								<feOffset dy="1" />
								<feGaussianBlur stdDeviation="0.5" />
								<feComposite
									in2="hardAlpha"
									operator="arithmetic"
									k2="-1"
									k3="1"
								/>
								<feColorMatrix
									type="matrix"
									values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
								/>
								<feBlend
									mode="normal"
									in2="effect3_innerShadow_36_471"
									result="effect4_innerShadow_36_471"
								/>
							</filter>
							<filter
								id="filter3_ii_36_471"
								x="36.999"
								y="59.6172"
								width="122"
								height="84"
								filterUnits="userSpaceOnUse"
								colorInterpolationFilters="sRGB"
							>
								<feFlood floodOpacity="0" result="BackgroundImageFix" />
								<feBlend
									mode="normal"
									in="SourceGraphic"
									in2="BackgroundImageFix"
									result="shape"
								/>
								<feColorMatrix
									in="SourceAlpha"
									type="matrix"
									values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
									result="hardAlpha"
								/>
								<feMorphology
									radius="4"
									operator="erode"
									in="SourceAlpha"
									result="effect1_innerShadow_36_471"
								/>
								<feOffset dy="-2" />
								<feGaussianBlur stdDeviation="4" />
								<feComposite
									in2="hardAlpha"
									operator="arithmetic"
									k2="-1"
									k3="1"
								/>
								<feColorMatrix
									type="matrix"
									values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.2 0"
								/>
								<feBlend
									mode="normal"
									in2="shape"
									result="effect1_innerShadow_36_471"
								/>
								<feColorMatrix
									in="SourceAlpha"
									type="matrix"
									values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
									result="hardAlpha"
								/>
								<feOffset dy="2" />
								<feGaussianBlur stdDeviation="1" />
								<feComposite
									in2="hardAlpha"
									operator="arithmetic"
									k2="-1"
									k3="1"
								/>
								<feColorMatrix
									type="matrix"
									values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.05 0"
								/>
								<feBlend
									mode="normal"
									in2="effect1_innerShadow_36_471"
									result="effect2_innerShadow_36_471"
								/>
							</filter>
							<filter
								id="filter4_ii_36_471"
								x="85.999"
								y="89.6172"
								width="24"
								height="26"
								filterUnits="userSpaceOnUse"
								colorInterpolationFilters="sRGB"
							>
								<feFlood floodOpacity="0" result="BackgroundImageFix" />
								<feBlend
									mode="normal"
									in="SourceGraphic"
									in2="BackgroundImageFix"
									result="shape"
								/>
								<feColorMatrix
									in="SourceAlpha"
									type="matrix"
									values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
									result="hardAlpha"
								/>
								<feOffset dy="1" />
								<feGaussianBlur stdDeviation="1" />
								<feComposite
									in2="hardAlpha"
									operator="arithmetic"
									k2="-1"
									k3="1"
								/>
								<feColorMatrix
									type="matrix"
									values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0"
								/>
								<feBlend
									mode="normal"
									in2="shape"
									result="effect1_innerShadow_36_471"
								/>
								<feColorMatrix
									in="SourceAlpha"
									type="matrix"
									values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
									result="hardAlpha"
								/>
								<feOffset dy="2" />
								<feGaussianBlur stdDeviation="1" />
								<feComposite
									in2="hardAlpha"
									operator="arithmetic"
									k2="-1"
									k3="1"
								/>
								<feColorMatrix
									type="matrix"
									values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.04 0"
								/>
								<feBlend
									mode="normal"
									in2="effect1_innerShadow_36_471"
									result="effect2_innerShadow_36_471"
								/>
							</filter>
						</defs>
					</svg>

					<p className="text-sm text-[#A1A1A1] text-center mb-4">
						Drop an image or video to start creating.
					</p>
					<label className="block text-center border border-1 border-[#333] hover:bg-neutral-900/50 hover:opacity-90 active:text-white/70 active:scale-[.98] transition-transform duration-100 ease text-white w-full px-3 py-1.5 h-10 content-center rounded-lg text-sm font-medium cursor-pointer w-full hover:shadow-[inset_0_5px_5px_0_rgba(255,255,255,0.05)]">
						Upload
						<input
							type="file"
							accept="image/*,video/*"
							onChange={handleMediaUpload}
							style={{ display: "none" }}
						/>
					</label>
				</div>
			)}
		</div>
	);
}

export default Controls;
