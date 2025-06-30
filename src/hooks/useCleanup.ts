import { useEffect, useRef } from 'react';

// Hook to manage component cleanup and prevent memory leaks
export const useCleanup = () => {
  const timeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const intervalsRef = useRef<Set<NodeJS.Timer>>(new Set());
  
  const setTimeout = (callback: () => void, delay: number): NodeJS.Timeout => {
    const timeoutId = globalThis.setTimeout(() => {
      timeoutsRef.current.delete(timeoutId);
      callback();
    }, delay);
    
    timeoutsRef.current.add(timeoutId);
    return timeoutId;
  };

  const clearTimeout = (timeoutId: NodeJS.Timeout): void => {
    globalThis.clearTimeout(timeoutId);
    timeoutsRef.current.delete(timeoutId);
  };

  const setInterval = (callback: () => void, delay: number): NodeJS.Timer => {
    const intervalId = globalThis.setInterval(callback, delay);
    intervalsRef.current.add(intervalId);
    return intervalId;
  };

  const clearInterval = (intervalId: NodeJS.Timer): void => {
    globalThis.clearInterval(intervalId);
    intervalsRef.current.delete(intervalId);
  };

  const cleanup = () => {
    // Clear all pending timeouts and intervals
    timeoutsRef.current.forEach(id => globalThis.clearTimeout(id));
    intervalsRef.current.forEach(id => globalThis.clearInterval(id));
    timeoutsRef.current.clear();
    intervalsRef.current.clear();
  };

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, []);

  return {
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    cleanup,
    activeTimeouts: timeoutsRef.current.size,
    activeIntervals: intervalsRef.current.size
  };
};