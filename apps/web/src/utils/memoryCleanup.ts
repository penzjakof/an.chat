/**
 * Утиліти для запобігання memory leaks в React компонентах
 */

// Тип для cleanup функцій
type CleanupFunction = () => void;

// Клас для управління ресурсами компонента
export class ComponentResourceManager {
  private timeouts: Set<NodeJS.Timeout> = new Set();
  private intervals: Set<NodeJS.Timeout> = new Set();
  private eventListeners: Array<{
    element: EventTarget;
    event: string;
    handler: EventListener;
    options?: boolean | AddEventListenerOptions;
  }> = [];
  private abortControllers: Set<AbortController> = new Set();
  private cleanupFunctions: Set<CleanupFunction> = new Set();

  /**
   * Створює timeout з автоматичним cleanup
   */
  setTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    const timeoutId = setTimeout(() => {
      this.timeouts.delete(timeoutId);
      callback();
    }, delay);
    
    this.timeouts.add(timeoutId);
    return timeoutId;
  }

  /**
   * Створює interval з автоматичним cleanup
   */
  setInterval(callback: () => void, delay: number): NodeJS.Timeout {
    const intervalId = setInterval(callback, delay);
    this.intervals.add(intervalId);
    return intervalId;
  }

  /**
   * Додає event listener з автоматичним cleanup
   */
  addEventListener<K extends keyof WindowEventMap>(
    element: Window,
    type: K,
    listener: (this: Window, ev: WindowEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener<K extends keyof DocumentEventMap>(
    element: Document,
    type: K,
    listener: (this: Document, ev: DocumentEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener<K extends keyof HTMLElementEventMap>(
    element: HTMLElement,
    type: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(
    element: EventTarget,
    event: string,
    handler: EventListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    element.addEventListener(event, handler, options);
    this.eventListeners.push({ element, event, handler, options });
  }

  /**
   * Створює AbortController з автоматичним cleanup
   */
  createAbortController(): AbortController {
    const controller = new AbortController();
    this.abortControllers.add(controller);
    return controller;
  }

  /**
   * Додає кастомну cleanup функцію
   */
  addCleanup(cleanupFn: CleanupFunction): void {
    this.cleanupFunctions.add(cleanupFn);
  }

  /**
   * Видаляє конкретний timeout
   */
  clearTimeout(timeoutId: NodeJS.Timeout): void {
    if (this.timeouts.has(timeoutId)) {
      clearTimeout(timeoutId);
      this.timeouts.delete(timeoutId);
    }
  }

  /**
   * Видаляє конкретний interval
   */
  clearInterval(intervalId: NodeJS.Timeout): void {
    if (this.intervals.has(intervalId)) {
      clearInterval(intervalId);
      this.intervals.delete(intervalId);
    }
  }

  /**
   * Очищає всі ресурси
   */
  cleanup(): void {
    console.log('🧹 ComponentResourceManager: Cleaning up all resources...');

    // Очищуємо timeouts
    this.timeouts.forEach(timeoutId => {
      try {
        clearTimeout(timeoutId);
      } catch (error) {
        console.warn('Error clearing timeout:', error);
      }
    });
    this.timeouts.clear();

    // Очищуємо intervals
    this.intervals.forEach(intervalId => {
      try {
        clearInterval(intervalId);
      } catch (error) {
        console.warn('Error clearing interval:', error);
      }
    });
    this.intervals.clear();

    // Видаляємо event listeners
    this.eventListeners.forEach(({ element, event, handler, options }) => {
      try {
        element.removeEventListener(event, handler, options);
      } catch (error) {
        console.warn('Error removing event listener:', error);
      }
    });
    this.eventListeners.length = 0;

    // Скасовуємо всі AbortControllers
    this.abortControllers.forEach(controller => {
      try {
        if (!controller.signal.aborted) {
          controller.abort();
        }
      } catch (error) {
        console.warn('Error aborting controller:', error);
      }
    });
    this.abortControllers.clear();

    // Викликаємо кастомні cleanup функції
    this.cleanupFunctions.forEach(cleanupFn => {
      try {
        cleanupFn();
      } catch (error) {
        console.warn('Error in custom cleanup function:', error);
      }
    });
    this.cleanupFunctions.clear();

    console.log('✅ ComponentResourceManager: All resources cleaned up');
  }

  /**
   * Отримує статистику ресурсів
   */
  getStats(): {
    timeouts: number;
    intervals: number;
    eventListeners: number;
    abortControllers: number;
    cleanupFunctions: number;
  } {
    return {
      timeouts: this.timeouts.size,
      intervals: this.intervals.size,
      eventListeners: this.eventListeners.length,
      abortControllers: this.abortControllers.size,
      cleanupFunctions: this.cleanupFunctions.size,
    };
  }
}

/**
 * React Hook для автоматичного управління ресурсами
 */
import { useEffect, useRef } from 'react';

export function useResourceManager(): ComponentResourceManager {
  const managerRef = useRef<ComponentResourceManager>();

  if (!managerRef.current) {
    managerRef.current = new ComponentResourceManager();
  }

  useEffect(() => {
    const manager = managerRef.current!;
    
    return () => {
      manager.cleanup();
    };
  }, []);

  return managerRef.current;
}

/**
 * Hook для безпечного setTimeout з автоматичним cleanup
 */
export function useSafeTimeout(): (callback: () => void, delay: number) => NodeJS.Timeout {
  const manager = useResourceManager();
  
  return (callback: () => void, delay: number) => {
    return manager.setTimeout(callback, delay);
  };
}

/**
 * Hook для безпечного setInterval з автоматичним cleanup
 */
export function useSafeInterval(): (callback: () => void, delay: number) => NodeJS.Timeout {
  const manager = useResourceManager();
  
  return (callback: () => void, delay: number) => {
    return manager.setInterval(callback, delay);
  };
}

/**
 * Hook для безпечного addEventListener з автоматичним cleanup
 */
export function useSafeEventListener(): ComponentResourceManager['addEventListener'] {
  const manager = useResourceManager();
  
  return manager.addEventListener.bind(manager);
}

/**
 * Hook для створення AbortController з автоматичним cleanup
 */
export function useSafeAbortController(): () => AbortController {
  const manager = useResourceManager();
  
  return () => manager.createAbortController();
}

/**
 * Утиліта для очищення Lottie анімацій
 */
export function cleanupLottieAnimations(): void {
  if (typeof window === 'undefined') return;

  console.log('🧹 Cleaning up Lottie animations...');
  
  if (window.activeLottieInstances) {
    window.activeLottieInstances.forEach((animation, key) => {
      try {
        if (animation && typeof animation.destroy === 'function') {
          animation.destroy();
          console.log(`✅ Destroyed Lottie animation: ${key}`);
        }
        
        // Видаляємо event listeners
        if (animation && typeof animation.removeEventListener === 'function') {
          ['data_ready', 'error', 'complete', 'loopComplete', 'enterFrame'].forEach(event => {
            try {
              animation.removeEventListener(event);
            } catch (e) {
              // Ігноруємо помилки видалення listeners
            }
          });
        }
      } catch (error) {
        console.warn(`⚠️ Error destroying Lottie animation ${key}:`, error);
      }
    });
    window.activeLottieInstances.clear();
  }
  
  // Очищуємо DOM елементи з Lottie
  if (typeof document !== 'undefined') {
    const lottieContainers = document.querySelectorAll('[data-lottie-url]');
    lottieContainers.forEach(container => {
      if (container instanceof HTMLElement) {
        container.innerHTML = '';
        // Видаляємо data атрибути
        container.removeAttribute('data-lottie-url');
      }
    });
  }
}

/**
 * Утиліта для перевірки memory leaks в development режимі
 */
export function detectMemoryLeaks(): void {
  if (process.env.NODE_ENV !== 'development') return;

  const checkLeaks = () => {
    const stats = {
      lottieInstances: window.activeLottieInstances?.size || 0,
      eventListeners: 0, // Складно точно підрахувати
      timers: 0, // Складно точно підрахувати
    };

    console.log('🔍 Memory leak detection:', stats);

    if (stats.lottieInstances > 10) {
      console.warn('⚠️ Potential memory leak: Too many Lottie instances:', stats.lottieInstances);
    }
  };

  // Перевіряємо кожні 30 секунд в development
  setInterval(checkLeaks, 30000);
}

/**
 * Ініціалізація memory leak detection
 */
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Ініціалізуємо глобальний Map для Lottie якщо його немає
  if (!window.activeLottieInstances) {
    window.activeLottieInstances = new Map();
  }
  
  // Запускаємо детекцію memory leaks
  detectMemoryLeaks();
}
