import { ImageResponse } from 'next/og';

export const size = {
	width: 32,
	height: 32,
};
export const contentType = 'image/png';

export default function Icon() {
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
					borderRadius: '6px',
				}}
			>
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					{/* Calendar base */}
					<rect x="2" y="4" width="20" height="18" rx="3" fill="white" />
					{/* Header dots */}
					<circle cx="7" cy="8" r="1.5" fill="#007AFF" />
					<circle cx="12" cy="8" r="1.5" fill="#007AFF" />
					<circle cx="17" cy="8" r="1.5" fill="#007AFF" />
					{/* Checkmark */}
					<path
						d="M8 15L11 18L17 12"
						stroke="#007AFF"
						strokeWidth="2"
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
