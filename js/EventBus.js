 class EventBus {
            constructor() { this.events = {}; }
            on(event, callback) {
                if (!this.events[event]) this.events[event] = [];
                this.events[event].push(callback);
            }
            emit(event, payload = {}) {
                if (!this.events[event]) return;
                this.events[event].forEach(callback => callback(payload));
            }
        }
