/**
         * MIGRATION: MOVE TO js/Orchestrator.js
         */
        class Orchestrator {
            constructor(canvas, bus, physics) {
                this.canvas = canvas;
                this.ctx = canvas.getContext('2d');
                this.bus = bus;
                this.physics = physics;
                this.lastTime = 0;
                this.init();
            }
            init() {
                window.addEventListener('resize', () => this.resize());
                this.resize();
                this.loop(0);
            }
            resize() {
                this.canvas.width = this.canvas.offsetWidth;
                this.canvas.height = this.canvas.offsetHeight;
            }
            loop(timestamp) {
                const dt = (timestamp - this.lastTime) / 1000;
                this.lastTime = timestamp;
                this.physics.update(dt);
                this.draw();
                requestAnimationFrame((t) => this.loop(t));
            }
            draw() {
                const { width, height } = this.canvas;
                this.ctx.clearRect(0, 0, width, height);
                const toPx = (lx, ly) => ({
                    x: (lx / 100) * width,
                    y: (1 - (ly / 60)) * height
                });
                const h = this.physics.lastH;
                const k = this.physics.lastK;
                const h2 = h*h;
                const a = h2 === 0 ? 0 : -k/h2;

                this.ctx.beginPath();
                this.ctx.setLineDash([5, 5]);
                this.ctx.strokeStyle = this.physics.isJammed ? 'rgba(255, 0, 0, 0.4)' : 'rgba(0, 243, 255, 0.2)';
                for(let x = 0; x <= 100; x += 2) {
                    const y = a * Math.pow(x - h, 2) + k;
                    const pos = toPx(x, y);
                    if (x === 0) this.ctx.moveTo(pos.x, pos.y);
                    else this.ctx.lineTo(pos.x, pos.y);
                }
                this.ctx.stroke();
                this.ctx.setLineDash([]);

                this.physics.projectiles.forEach(p => {
                    const logicPos = p.getCurrentPos();
                    const pxPos = toPx(logicPos.x, logicPos.y);
                    this.ctx.fillStyle = p.type === 'slag' ? '#ff4400' : '#00f3ff';
                    this.ctx.shadowBlur = 10;
                    this.ctx.shadowColor = this.ctx.fillStyle;
                    this.ctx.beginPath();
                    this.ctx.arc(pxPos.x, pxPos.y, p.type === 'slag' ? 2 : 4, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.shadowBlur = 0;
                });

                this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.05)';
                this.ctx.lineWidth = 1;
                for(let i = 0; i <= 100; i += 10) {
                    const x = (i / 100) * width;
                    this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, height); this.ctx.stroke();
                }
            }
        }
