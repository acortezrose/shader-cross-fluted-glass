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

export default Slider;
