export default function Slider({
	label,
	value,
	min,
	max,
	step,
	onChange,
	unit = "",
}) {
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

export function Seek({ config, setConfig, videoRef }) {
	const progress = (config.currentTime / config.duration) * 100;

	const handleSeek = (e) => {
		if (videoRef.current) {
			const value = parseFloat(e.target.value);
			videoRef.current.currentTime = value;
			setConfig((prev) => ({ ...prev, currentTime: value }));
		}
	};

	return (
		<input
			type="range"
			min="0"
			max={config.duration || 0}
			step="0.1"
			value={config.currentTime}
			onChange={handleSeek}
			className="w-full slider seek"
			style={{
				"--slider-progress": `${progress}%`,
			}}
		/>
	);
}
