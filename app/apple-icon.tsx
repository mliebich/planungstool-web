import { ImageResponse } from 'next/og';

export const size = {
	width: 180,
	height: 180,
};
export const contentType = 'image/png';

export default function AppleIcon() {
	return new ImageResponse(
		(
			<div
				style={{
					width: '100%',
					height: '100%',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					background: '#007AFF',
					borderRadius: '36px',
				}}
			>
				<svg
					width="120"
					height="120"
					viewBox="0 0 120 120"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					{/* Calendar/planner background */}
					<rect x="15" y="25" width="90" height="80" rx="10" fill="white" fillOpacity="0.95" />
					{/* Header bar */}
					<rect x="15" y="15" width="90" height="22" rx="10" fill="white" />
					<circle cx="35" cy="26" r="5" fill="#007AFF" />
					<circle cx="55" cy="26" r="5" fill="#007AFF" />
					<circle cx="75" cy="26" r="5" fill="#007AFF" />
					{/* Checkmark */}
					<path
						d="M42 70L55 83L82 52"
						stroke="#007AFF"
						strokeWidth="8"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</div>
		),
		{
			...size,
		}
	);
}
