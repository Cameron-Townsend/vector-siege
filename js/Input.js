/**
         * MIGRATION: MOVE TO js/Input.js
         */
        class InputTranslator {
            constructor(canvas, bus) {
                this.canvas = canvas;
                this.bus = bus;
                this.setupListeners();
            }
            setupListeners() {
                const handleInteraction = (e) => {
                    const rect = this.canvas.getBoundingClientRect();
                    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                    const logicX = ((clientX - rect.left) / rect.width) * 100;
                    const logicY = 60 - (((clientY - rect.top) / rect.height) * 60);
                    this.bus.emit('INPUT_INTERACTION', { h: logicX, k: logicY });
                };

                // Track aiming position
                this.canvas.addEventListener('mousemove', handleInteraction);
                this.canvas.addEventListener('touchstart', handleInteraction);
                this.canvas.addEventListener('touchmove', handleInteraction);

                // MIGRATION ADDITION: Mouse Click to Fire on Canvas
                this.canvas.addEventListener('mousedown', (e) => {
                    if (e.button === 0) { // Only fire on primary (left) click
                        this.bus.emit('UI_ACTION', { type: 'fire' });
                    }
                });
            }
        }
