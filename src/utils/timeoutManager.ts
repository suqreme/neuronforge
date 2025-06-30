// Timeout management utility to prevent memory leaks
class TimeoutManager {
  private timeouts: Set<NodeJS.Timeout> = new Set();

  setTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    const timeoutId = setTimeout(() => {
      this.timeouts.delete(timeoutId);
      callback();
    }, delay);
    
    this.timeouts.add(timeoutId);
    return timeoutId;
  }

  clearTimeout(timeoutId: NodeJS.Timeout): void {
    clearTimeout(timeoutId);
    this.timeouts.delete(timeoutId);
  }

  clearAll(): void {
    this.timeouts.forEach(timeoutId => {
      clearTimeout(timeoutId);
    });
    this.timeouts.clear();
  }

  getActiveTimeouts(): number {
    return this.timeouts.size;
  }
}

export const timeoutManager = new TimeoutManager();