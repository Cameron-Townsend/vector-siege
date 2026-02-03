  /**
         * MIGRATION: MOVE TO js/main.js
         */
        window.onload = () => {
            const bus = new EventBus();
            const canvas = document.getElementById('gameCanvas');
            const physics = new PhysicsEngine(bus);
            const engine = new Orchestrator(canvas, bus, physics);
            const input = new InputTranslator(canvas, bus);
            const ui = new UIController(bus);
            console.log("Vector Siege Phase 2 Initialized.");
        };
