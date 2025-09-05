"use client";

import React, { useEffect } from 'react';

type ImagePreviewModalProps = {
	isOpen: boolean;
	src: string | null;
	isLoading?: boolean;
	onClose: () => void;
};

export default function ImagePreviewModal({ isOpen, src, isLoading = false, onClose }: ImagePreviewModalProps) {
	useEffect(() => {
		if (!isOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	return (
		<div 
			className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60]"
			onClick={onClose}
		>
			<div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
				{isLoading ? (
					<div className="w-16 h-16 border-4 border-white/40 border-t-white rounded-full animate-spin" />
				) : (
					src && (
						<img
							src={src}
							alt="Preview"
							className="max-w-full max-h-full object-contain rounded-lg cursor-pointer"
							onClick={onClose}
						/>
					)
				)}
				<button
					onClick={onClose}
					className="absolute top-4 right-4 w-10 h-10 bg-black bg-opacity-60 rounded-full flex items-center justify-center text-white hover:bg-opacity-80 transition-all"
					title="Закрити"
				>
					<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>
	);
}


