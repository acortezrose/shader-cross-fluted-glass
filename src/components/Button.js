import React from "react";

const Button = ({
	children,
	onClick,
	disabled = false,
	variant = "primary",
	icon = null,
	shortcut = null,
	className = "",
	asChild = false,
	...props
}) => {
	const baseStyles =
		"flex flex-row items-center justify-center text-center gap-2 border border-1 hover:opacity-90 hover:text-white/70 active:scale-[.98] transition-transform duration-100 ease text-white px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

	const variantStyles = {
		primary:
			"bg-[#0080FF] border-[#3098FF] shadow-[inset_0_4px_4px_0_rgba(255,255,255,0.15)]",
		secondary: "field-secondary text-white/95",
		icon: "bg-transparent border-0 p-0 h-auto w-auto hover:opacity-70 shadow-none",
		mediaIcon:
			"bg-[#0a0a0a]/50 border-[#333]/40 p-0 hover:bg-neutral-900/50 hover:shadow-[inset_0_5px_5px_0_rgba(255,255,255,0.05)] disabled:hover:shadow-none disabled:active:scale-100 disabled:active:text-white/100",
	};

	const combinedStyles = `${baseStyles} ${variantStyles[variant]} ${className}`;

	if (asChild) {
		const child = React.Children.only(children);
		return React.cloneElement(child, {
			...props,
			...(onClick && { onClick }),
			className: `${combinedStyles} ${child.props.className || ""}`.trim(),
		});
	}

	return (
		<button
			onClick={onClick}
			disabled={disabled}
			className={combinedStyles}
			{...props}
		>
			{icon && <span className="flex-shrink-0">{icon}</span>}
			{children && <span>{children}</span>}
			{shortcut && <span className="text-white/40 ml-1">{shortcut}</span>}
		</button>
	);
};

export default Button;
