/**
         * MIGRATION: MOVE TO js/Physics.js
         */
        class Projectile {
            constructor(origin, h, k, type = 'standard') {
                this.origin = { ...origin };
                this.h = h; this.k = k;
                this.type = type;
                this.age = 0; 
                this.speed = 2.0; 
                this.active = true;
                this.points = this.precalculate();
            }

            precalculate() {
                const pts = [];
                const h2 = this.h * this.h;
                const a = h2 === 0 ? 0 : -this.k / h2;
                for(let x = 0; x <= 110; x += 0.5) {
                    const y = a * Math.pow(x - this.h, 2) + this.k;
                    pts.push({x, y});
                    if (y < -5) break; 
                }
                return pts;
            }

            update(dt) {
                this.age += dt * this.speed;
                const idx = Math.floor(this.age * 25);
                if (idx >= this.points.length) this.active = false;
            }

            getCurrentPos() {
                const idx = Math.min(Math.floor(this.age * 25), this.points.length - 1);
                return this.points[idx] || { x: 0, y: 0 };
            }
        }

        /**
         * MIGRATION: MOVE TO js/Physics.js
         */
        class PhysicsEngine {
            constructor(bus) {
                this.bus = bus;
                this.projectiles = [];
                this.lastH = 50; 
                this.lastK = 30;
                this.heat = 0;
                this.isJammed = false;
                this.coolingRate = 12; 
                
                this.bus.on('INPUT_INTERACTION', d => {
                    this.lastH = d.h;
                    this.lastK = d.k;
                });

                this.bus.on('UI_ACTION', d => {
                    if (d.type === 'fire') this.fire();
                });
            }

            fire() {
                let targetH = this.lastH;
                let targetK = this.lastK;

                if (this.isJammed) {
                    targetH += (Math.random() - 0.5) * 40;
                    targetK += (Math.random() - 0.5) * 40;
                }

                const p = new Projectile({x: 0, y: 0}, targetH, targetK, this.isJammed ? 'slag' : 'standard');
                this.projectiles.push(p);

                if (!this.isJammed) {
                    this.heat += 10;
                    if (this.heat >= 100) {
                        this.heat = 100;
                        this.isJammed = true;
                        this.bus.emit('JAM_STATE', { active: true });
                    }
                    this.bus.emit('HEAT_UPDATE', { heat: this.heat });
                }
            }

            update(dt) {
                if (this.heat > 0) {
                    this.heat -= dt * this.coolingRate;
                    if (this.isJammed && this.heat <= 0) {
                        this.isJammed = false;
                        this.bus.emit('JAM_STATE', { active: false });
                    }
                    if (this.heat < 0) this.heat = 0;
                    this.bus.emit('HEAT_UPDATE', { heat: this.heat });
                }
                this.projectiles = this.projectiles.filter(p => p.active);
                this.projectiles.forEach(p => p.update(dt));
            }
        }
