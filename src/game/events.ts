type EventHandler = (data?: any) => void;

class EventBus {
  private listeners: Record<string, EventHandler[]> = {};

  on(event: string, callback: EventHandler) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event: string, callback: EventHandler) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event: string, data?: any) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => callback(data));
  }
  
  clear() {
    this.listeners = {};
  }
}

export const gameEvents = new EventBus();

// Allowed Events
export const GameEvent = {
  ENEMY_DIED: 'ENEMY_DIED',
  PLAYER_HIT: 'PLAYER_HIT',
  PLAYER_DIED: 'PLAYER_DIED',
  OBSTACLE_DESTROYED: 'OBSTACLE_DESTROYED',
  POWERUP_COLLECTED: 'POWERUP_COLLECTED'
};
