"use client";

import React, { Component, ReactNode } from 'react';

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
	onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
	hasError: boolean;
	error?: Error;
}

class LottieErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		console.error('🎭 Lottie Error Boundary caught an error:', error, errorInfo);

		// Викликаємо callback якщо він наданий
		if (this.props.onError) {
			this.props.onError(error, errorInfo);
		}

		// Логуємо детальну інформацію про помилку
		console.error('🎭 Lottie Error Details:');
		console.error('- Error message:', error.message);
		console.error('- Error stack:', error.stack);
		console.error('- Component stack:', errorInfo.componentStack);
	}

	render() {
		if (this.state.hasError) {
			// Показуємо fallback UI
			if (this.props.fallback) {
				return this.props.fallback;
			}

			// Default fallback UI для Lottie помилок
			return (
				<div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-100 to-purple-100 rounded-md">
					<div className="text-center p-2">
						<div className="text-2xl mb-1">🎭</div>
						<div className="text-xs text-gray-600 font-medium">Помилка анімації</div>
						<div className="text-xs text-gray-500 mt-1">Lottie</div>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}

// HOC для зручного використання з Lottie компонентами
export const withLottieErrorBoundary = <P extends object>(
	Component: React.ComponentType<P>,
	fallback?: ReactNode,
	onError?: (error: Error, errorInfo: React.ErrorInfo) => void
) => {
	return (props: P) => (
		<LottieErrorBoundary fallback={fallback} onError={onError}>
			<Component {...props} />
		</LottieErrorBoundary>
	);
};

export default LottieErrorBoundary;
