window.onload = () => {
           window.onload = () => {
            const bus = new EventBus();
            const canvas = document.getElementById('gameCanvas');
            
            // Physics Engine handles the heavy lifting
            const physics = new PhysicsEngine(bus);
            
            const engine = new Orchestrator(canvas, bus, physics);
            const input = new InputTranslator(canvas, bus);
            const ui = new UIController(bus);
            
            console.log("Vector Siege Phase 2 Initialized.");
        };
            // Debug Keys
            window.addEventListener('keydown', (e) => {
                if (e.key === 'j') {
                    bus.emit('JAM_STATE', { active: true });
                    bus.emit('HEAT_UPDATE', { heat: 100 });
                }
                if (e.key === 'n') {
                    bus.emit('JAM_STATE', { active: false });
                    bus.emit('HEAT_UPDATE', { heat: 0 });
                }
            });
        };
