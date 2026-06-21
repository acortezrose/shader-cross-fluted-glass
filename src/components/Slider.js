import { useRef, useState, useCallback, useEffect } from "react";
import { motion } from "motion/react";
import "./Slider.css";

function decimalPlaces(step) {
	const str = String(step);
	const i = str.indexOf(".");
	return i === -1 ? 0 : str.length - i - 1;
}

export default function Slider({
	label,
	value,
	min,
	max,
	step = 1,
	onChange,
	unit = "",
}) {
	const precision = decimalPlaces(step);
	const [isDragging, setIsDragging] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(`${value.toFixed(precision)}${unit}`);
	const trackRef = useRef(null);

	useEffect(() => {
		if (!isEditing) {
			setDraft(`${value.toFixed(precision)}${unit}`);
		}
	}, [value, unit, precision, isEditing]);

	const commit = useCallback(
		(next) => {
			if (isNaN(next)) return;
			const stepped = Math.round((next - min) / step) * step + min;
			const clamped = Math.min(Math.max(stepped, min), max);
			onChange?.(Number(clamped.toFixed(precision)));
		},
		[min, max, step, precision, onChange],
	);

	function getClientX(e) {
		if (e.touches?.length) return e.touches[0].clientX;
		return e.clientX;
	}

	const valueFromEvent = useCallback(
		(e) => {
			const rect = trackRef.current.getBoundingClientRect();
			const percent = (getClientX(e) - rect.left) / rect.width;
			const clampedPercent = Math.min(Math.max(percent, 0), 1);
			return clampedPercent * (max - min) + min;
		},
		[min, max],
	);

	const handleWindowMouseMove = useCallback(
		(e) => commit(valueFromEvent(e)),
		[commit, valueFromEvent],
	);

	const handleWindowMouseUp = useCallback(() => setIsDragging(false), []);

	useEffect(() => {
		if (isDragging) {
			window.addEventListener("mousemove", handleWindowMouseMove);
			window.addEventListener("mouseup", handleWindowMouseUp);
		}
		return () => {
			window.removeEventListener("mousemove", handleWindowMouseMove);
			window.removeEventListener("mouseup", handleWindowMouseUp);
		};
	}, [isDragging, handleWindowMouseMove, handleWindowMouseUp]);

	function updateValueFromKeyboard(e) {
		if (e.key === "ArrowRight" || e.key === "ArrowUp") {
			e.preventDefault();
			commit(value + (e.shiftKey ? step * 10 : step));
		} else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
			e.preventDefault();
			commit(value - (e.shiftKey ? step * 10 : step));
		}
	}

	function commitDraft() {
		commit(parseFloat(draft));
		setIsEditing(false);
	}

	const progress = ((value - min) / (max - min)) * 100;

	return (
		<div className="mb-5">
			<div className="flex flex-row justify-between gap-0">
				<label className="text-sm text-[#a1a1a1] w-full">{label}</label>
				<motion.p className="w-16 flex-shrink-0">
					<input
						className="appearance-none bg-transparent text-right text-sm text-[#a1a1a1] opacity-80 hover:opacity-100 w-full focus-visible:outline-none border-b border-b-2 border-transparent focus-visible:border-b-[#666]"
						value={draft}
						onFocus={() => setIsEditing(true)}
						onChange={(e) => setDraft(e.target.value)}
						onBlur={commitDraft}
						onKeyDown={(e) => {
							if (e.key === "Enter") e.currentTarget.blur();
						}}
					/>
				</motion.p>
			</div>
			<div
				ref={trackRef}
				className="h-6 flex items-center slider-container relative mt-0 focus-visible:outline-3 focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_#000,0_0_0_3px_#666] rounded-full touch-none"
				onMouseDown={(e) => {
					setIsDragging(true);
					commit(valueFromEvent(e));
				}}
				onTouchStart={(e) => {
					setIsDragging(true);
					commit(valueFromEvent(e));
				}}
				onTouchMove={(e) => commit(valueFromEvent(e))}
				onTouchEnd={() => setIsDragging(false)}
				onKeyDown={updateValueFromKeyboard}
				tabIndex="0"
			>
				<div className="w-full h-3 bg-[#333]/30 rounded-full overflow-hidden transition-all duration-300 relative slider-track active:cursor-grab">
					<motion.div
						className="h-full bg-gradient-to-t from-[#DBDBDB]/90 to-[#F5F5F5]/90 shadow-[inset_0_4px_4px_0_rgba(255,255,255,.3)]"
						initial={false}
						animate={{ width: `${progress}%` }}
						transition={{
							type: "spring",
							stiffness: 650,
							damping: 25,
							mass: 0.5,
						}}
					/>
				</div>
				<div className="slider-ticks absolute top-0 left-0 h-6 w-full flex flex-row items-center justify-between gap-1 z-10 mix-blend-difference">
					{Array.from({ length: 11 }).map((_, index) => (
						<div
							key={index}
							className={`w-px bg-[#dedede] ${index % 2 === 0 ? "h-2" : "h-1.5"} ${index === 0 || index === 10 ? "opacity-0" : "opacity-30"}`}
						/>
					))}
				</div>
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
