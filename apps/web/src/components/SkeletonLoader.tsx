interface SkeletonLoaderProps {
	className?: string;
}

export function SkeletonLoader({ className = "" }: SkeletonLoaderProps) {
	return (
		<div className={`animate-pulse bg-gray-200 rounded ${className}`} />
	);
}

// Прелоадер для аватара
export function AvatarSkeleton({ size = "w-11 h-11" }: { size?: string }) {
	return <SkeletonLoader className={`${size} rounded-full`} />;
}

// Прелоадер для тексту
export function TextSkeleton({ width = "w-full", height = "h-4" }: { width?: string; height?: string }) {
	return <SkeletonLoader className={`${width} ${height}`} />;
}

// Прелоадер для діалогу в списку
export function DialogSkeleton() {
	return (
		<div className="p-3 animate-pulse">
			<div className="flex items-center gap-3">
				<AvatarSkeleton />
				<div className="flex-1 min-w-0">
					<div className="flex justify-between items-start">
						<div className="flex-1 min-w-0">
							<TextSkeleton width="w-32" className="mb-2" />
							<TextSkeleton width="w-24" height="h-3" />
						</div>
						<TextSkeleton width="w-12" height="h-3" />
					</div>
				</div>
			</div>
		</div>
	);
}

// Прелоадер для повідомлення
export function MessageSkeleton({ isFromProfile = false }: { isFromProfile?: boolean }) {
	return (
		<div className={`flex ${isFromProfile ? 'justify-end' : 'justify-start'} mb-4`}>
			<div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
				isFromProfile ? 'bg-purple-100' : 'bg-gray-100'
			} animate-pulse`}>
				<TextSkeleton width="w-48" className="mb-2" />
				<TextSkeleton width="w-32" />
				<TextSkeleton width="w-16" height="h-3" className="mt-2" />
			</div>
		</div>
	);
}

// Прелоадер для хедера чату
export function ChatHeaderSkeleton() {
	return (
		<div className="bg-white border-b border-gray-200 p-4">
			<div className="flex items-center justify-between">
				{/* Ліва частина - користувач */}
				<div className="flex items-center gap-3">
					<AvatarSkeleton />
					<div>
						<TextSkeleton width="w-32" className="mb-2" />
						<TextSkeleton width="w-16" height="h-3" />
					</div>
				</div>

				{/* Права частина - профіль */}
				<div className="flex items-center gap-3">
					<div className="text-right">
						<TextSkeleton width="w-28" className="mb-2" />
						<TextSkeleton width="w-20" height="h-3" />
					</div>
					<AvatarSkeleton />
				</div>
			</div>
		</div>
	);
}
