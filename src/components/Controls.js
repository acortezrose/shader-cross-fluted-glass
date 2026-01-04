import Slider from "./Slider";

function Controls({ config, setConfig, ASPECT_RATIOS }) {
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

	const handleImageUpload = (e) => {
		const file = e.target.files[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = (event) => {
				setConfig((prev) => ({ ...prev, imageUrl: event.target.result }));
			};
			reader.readAsDataURL(file);
		}
	};

	return (
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

			{config.imageUrl && (
				<>
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
							<h3 className="text-sm text-[#EDEDED]">Motion</h3>

							<label className="toggle-switch">
								<input
									aria-label="Enable motion"
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

								<div className="mb-4">
									<label className="text-sm text-[#a1a1a1] mb-2 flex flex-row">
										Direction
										<span className="block w-full text-right">
											{config.direction}°
										</span>
									</label>
									<div className="relative">
										<input
											type="range"
											min="0"
											max="360"
											step="15"
											value={config.direction}
											onChange={(e) =>
												setConfig((prev) => ({
													...prev,
													direction: parseFloat(e.target.value),
												}))
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

			{!config.imageUrl && (
				<p className="text-sm opacity-60 my-auto text-center">
					Upload an image to get started
				</p>
			)}
		</div>
	);
}

export default Controls;
