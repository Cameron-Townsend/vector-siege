class Orchestrator {
            constructor(canvas, bus) {
                this.canvas = canvas;
                this.ctx = canvas.getContext('2d');
                this.bus = bus;
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
                this.update(dt);
                this.draw();
                requestAnimationFrame((t) => this.loop(t));
            }
            update(dt) {}
            draw() {
                const { width, height } = this.canvas;
                this.ctx.clearRect(0, 0, width, height);
                this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.05)';
                this.ctx.lineWidth = 1;
                for(let i = 0; i <= 100; i += 10) {
                    const x = (i / 100) * width;
                    this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, height); this.ctx.stroke();
                }
                for(let i = 0; i <= 60; i += 10) {
                    const y = (i / 60) * height;
                    this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(width, y); this.ctx.stroke();
                }
            }
        }
