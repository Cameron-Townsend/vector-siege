// ==========================================================================
        // FILE: js/Registry.js
        // ==========================================================================
        const EVENTS = {
            CORE: { INIT: 'CORE_INIT', START: 'CORE_START', STATE_CHANGE: 'CORE_STATE_CHANGE' },
            INPUT: { INTERACTION: 'INPUT_INTERACTION' },
            UI: { ACTION: 'UI_ACTION', UPDATE: 'UI_UPDATE' },
            PHYSICS: { COLLISION: 'PHYSICS_COLLISION', FLIP: 'PHYSICS_FLIP', HEAT: 'PHYSICS_HEAT', JAM: 'PHYSICS_JAM' },
            SYSTEM: { SHIELD: 'SYSTEM_SHIELD', BUFF: 'SYSTEM_BUFF', SETTINGS: 'SYSTEM_SETTINGS' },
            WAVE: { START: 'WAVE_START', UPDATE: 'WAVE_UPDATE', CLEARED: 'WAVE_CLEARED' },
            SCORE: { AWARD: 'SCORE_AWARD', UPDATE: 'SCORE_UPDATE' },
            HULL: { DAMAGE: 'HULL_DAMAGE', UPDATE: 'HULL_UPDATE', FAILED: 'HULL_FAILED' },
            FX: { SHATTER: 'FX_SHATTER', SHAKE: 'FX_SHAKE' }
        };

        const GAME = {
            MAX_DT: 1 / 30,
            TRAJECTORY_STEPS: 180,
            MAX_PARTICLES: 240,
            AIM_MARGIN: 8,
            CORE_HULL: 5,
            CORE_RADIUS: 2.4,
            COLLISION_RADIUS: 3.25,
            WAVE_BASE_COUNT: 4,
            WAVE_COUNT_GROWTH: 2,
            WAVE_SPAWN_INTERVAL: 1.05,
            COLORS: {
                cyan: '#00f3ff',
                magenta: '#ff00ff',
                orange: '#ff8c00',
                slag: '#ff4400'
            },
            ENEMIES: {
                aeroDrone: {
                    id: 'aeroDrone',
                    label: 'Aero Drone',
                    strata: 1,
                    shape: 'triangle',
                    color: '#00b7ff',
                    hp: 1,
                    speed: 10,
                    reward: 10,
                    damage: 1
                },
                terraMole: {
                    id: 'terraMole',
                    label: 'Terra Mole',
                    strata: -1,
                    shape: 'diamond',
                    color: '#ff8c00',
                    hp: 1,
                    speed: 10,
                    reward: 10,
                    damage: 1
                }
            }
        };

        const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

        // ==========================================================================
        // FILE: js/EventBus.js
        // ==========================================================================
        class EventBus {
            constructor() { this.events = {}; }
            on(e, c) {
                (this.events[e] = this.events[e] || []).push(c);
                return () => { this.events[e] = (this.events[e] || []).filter(callback => callback !== c); };
            }
            emit(e, p = {}) { (this.events[e] || []).forEach(c => c(p)); }
        }

        // ==========================================================================
        // FILE: js/Audio.js
        // ==========================================================================
        class AudioEngine {
            constructor(bus) {
                this.bus = bus; this.ctx = null;
                this.masterGain = null;
                this.bgmGain = null;
                this.musicEnabled = true;
                this.volume = 0.1; // Default 10%
                this.bgmBuffer = null;
                this.bgmSource = null;
                
                this.bus.on(EVENTS.UI.ACTION, d => { 
                    if (d.type === 'fire') this.playShoot(); 
                    if (d.type === 'flip') this.playFlip(); 
                });
                this.bus.on(EVENTS.FX.SHATTER, d => this.playShatter());
                this.bus.on(EVENTS.SYSTEM.SETTINGS, d => this.updateSettings(d));
            }
            
            init() {
                if (this.ctx) return;
                try {
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    this.ctx = new AudioContext();
                    this.masterGain = this.ctx.createGain();
                    this.bgmGain = this.ctx.createGain();
                    
                    this.masterGain.connect(this.ctx.destination);
                    this.bgmGain.connect(this.masterGain);
                    
                    this.updateGain();
                    this.loadMusic(1); // Try to load Track 1
                } catch(e) { console.warn("Audio Init Failed", e); }
            }

            async loadMusic(trackIndex) {
                // Safety Rail: Don't crash if file missing
                try {
                    const response = await fetch(`bgmusic/Track ${trackIndex}.mp3`);
                    if (!response.ok) throw new Error('Track not found');
                    const arrayBuffer = await response.arrayBuffer();
                    this.bgmBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                    this.playBGM();
                } catch (e) {
                    console.log(`BGM Load Skipped: ${e.message}`);
                }
            }

            playBGM() {
                if (!this.bgmBuffer || !this.musicEnabled) return;
                if (this.bgmSource) this.bgmSource.stop();
                this.bgmSource = this.ctx.createBufferSource();
                this.bgmSource.buffer = this.bgmBuffer;
                this.bgmSource.loop = true;
                this.bgmSource.connect(this.bgmGain);
                this.bgmSource.start();
            }

            updateSettings(data) {
                if (typeof data.volume !== 'undefined') this.volume = data.volume;
                if (typeof data.music !== 'undefined') {
                    this.musicEnabled = data.music;
                    if (this.musicEnabled) {
                        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
                        this.playBGM();
                    } else {
                        if (this.bgmSource) this.bgmSource.stop();
                    }
                }
                this.updateGain();
            }

            updateGain() {
                if(this.masterGain) this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
            }

            playShoot() {
                if (!this.ctx) return;
                const o = this.ctx.createOscillator(), g = this.ctx.createGain();
                o.type = 'square'; o.frequency.setValueAtTime(880, this.ctx.currentTime);
                o.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.1);
                g.gain.setValueAtTime(0.05 * (this.volume * 10), this.ctx.currentTime); // SFX scales with vol
                g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
                o.connect(g); g.connect(this.masterGain);
                o.start(); o.stop(this.ctx.currentTime + 0.1);
            }
            playFlip() {
                if (!this.ctx) return;
                const o = this.ctx.createOscillator(), g = this.ctx.createGain();
                o.type = 'sine'; o.frequency.setValueAtTime(220, this.ctx.currentTime);
                o.frequency.linearRampToValueAtTime(440, this.ctx.currentTime + 0.05);
                g.gain.setValueAtTime(0.02 * (this.volume * 10), this.ctx.currentTime);
                o.connect(g); g.connect(this.masterGain);
                o.start(); o.stop(this.ctx.currentTime + 0.05);
            }
            playShatter() {
                if (!this.ctx) return;
                const bufferSize = this.ctx.sampleRate * 0.1, buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate), data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
                const n = this.ctx.createBufferSource(); n.buffer = buffer;
                const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2000;
                const g = this.ctx.createGain(); g.gain.setValueAtTime(0.03 * (this.volume * 10), this.ctx.currentTime);
                n.connect(f); f.connect(g); g.connect(this.masterGain);
                n.start(); n.stop(this.ctx.currentTime + 0.1);
            }
        }

        // ==========================================================================
        // FILE: js/FX.js
        // ==========================================================================
        class ParticleSystem {
            constructor() { this.particles = []; }
            spawn(x, y, color, count = 15) {
                const availableSlots = GAME.MAX_PARTICLES - this.particles.length;
                const spawnCount = Math.max(0, Math.min(count, availableSlots));
                for (let i = 0; i < spawnCount; i++) {
                    this.particles.push({ x, y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 1.0, color });
                }
            }
            update(dt) {
                for (let i = this.particles.length - 1; i >= 0; i--) {
                    const p = this.particles[i]; p.x += p.vx; p.y += p.vy; p.life -= dt * 3.0;
                    if (p.life <= 0) this.particles.splice(i, 1);
                }
            }
            draw(ctx) {
                this.particles.forEach(p => { ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.fillRect(p.x - 1, p.y - 1, 2, 2); });
                ctx.globalAlpha = 1.0;
            }
        }

        // ==========================================================================
        // FILE: js/Entities.js
        // ==========================================================================
        class Entity {
            constructor(x, y, type) {
                this.x = x; this.y = y; this.type = type;
                this.active = true;
            }
            update(dt) {}
            draw(ctx) {}
        }

        class Enemy extends Entity {
            constructor(definition, wave = 1, side = Math.random() < 0.5 ? -1 : 1) {
                const x = side < 0 ? -4 : 104;
                const yBand = 8 + Math.random() * 16;
                super(x, definition.strata * yBand, definition.id);
                this.definition = definition;
                this.hp = definition.hp;
                this.maxHp = definition.hp;
                this.speed = definition.speed + Math.max(0, wave - 1) * 0.8;
                this.reward = definition.reward;
                this.damage = definition.damage;
                this.strata = definition.strata;
                this.side = side;
                this.radius = 2.4;
            }
            update(dt) {
                const dx = 50 - this.x;
                const dy = 0 - this.y;
                const dist = Math.hypot(dx, dy) || 1;
                this.x += (dx / dist) * this.speed * dt;
                this.y += (dy / dist) * this.speed * dt;
                this.y = this.strata === 1 ? Math.max(3, this.y) : Math.min(-3, this.y);
            }
            get distanceToCore() { return Math.hypot(this.x - 50, this.y); }
            takeDamage(amount = 1) {
                this.hp -= amount;
                if (this.hp <= 0) this.active = false;
            }
            draw(ctx, toPx) {
                const pos = toPx(this.x, this.y);
                ctx.save();
                ctx.translate(pos.x, pos.y);
                ctx.strokeStyle = this.definition.color;
                ctx.fillStyle = this.definition.color;
                ctx.shadowBlur = 12;
                ctx.shadowColor = this.definition.color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                if (this.definition.shape === 'triangle') {
                    ctx.moveTo(0, -9); ctx.lineTo(8, 7); ctx.lineTo(-8, 7); ctx.closePath();
                } else {
                    ctx.moveTo(0, -9); ctx.lineTo(9, 0); ctx.lineTo(0, 9); ctx.lineTo(-9, 0); ctx.closePath();
                }
                ctx.globalAlpha = 0.18; ctx.fill(); ctx.globalAlpha = 1;
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#fff';
                ctx.fillRect(-5, 12, 10 * clamp(this.hp / this.maxHp, 0, 1), 2);
                ctx.restore();
            }
        }

        class Projectile extends Entity {
            constructor(origin, h, k, type = 'standard') {
                super(origin.x, origin.y, type);
                this.origin = { ...origin };
                this.h = h; this.k = k;
                this.distTraveled = 0; this.speed = type === 'slag' ? 40 : 65; 
                this.totalLength = 0;
                this.points = this.precalculate();
            }
            precalculate() {
                const pts = []; const dx = 50 - this.h; const denom = dx * dx; const a = denom === 0 ? 0 : -this.k / denom;
                const dir = this.h >= 50 ? 1 : -1; const xEnd = (2 * this.h) - 50; const xDistTotal = Math.abs(xEnd - 50);
                let lastX = 50, lastY = 0, cumulativeDist = 0; const stepSize = xDistTotal / GAME.TRAJECTORY_STEPS;
                for (let i = 0; i <= GAME.TRAJECTORY_STEPS; i++) {
                    const x = 50 + (i * stepSize * dir); const y = a * (x - this.h) * (x - this.h) + this.k;
                    cumulativeDist += Math.hypot(x - lastX, y - lastY);
                    pts.push({ x, y, d: cumulativeDist }); lastX = x; lastY = y;
                }
                this.totalLength = cumulativeDist; return pts;
            }
            update(dt) {
                this.distTraveled += dt * this.speed;
                if (this.distTraveled >= this.totalLength) this.active = false;
            }
            getCurrentPos() {
                const target = this.distTraveled; let low = 0, high = this.points.length - 1;
                while (low <= high) {
                    let mid = (low + high) >> 1;
                    if (this.points[mid].d < target) low = mid + 1; else high = mid - 1;
                }
                return this.points[low] || this.points[this.points.length - 1] || { x: 50, y: 0 };
            }
        }

        // ==========================================================================
        // FILE: js/EnemyManager.js
        // ==========================================================================
        class EnemyManager {
            constructor(bus) {
                this.bus = bus;
                this.enemies = [];
            }
            spawn(type, wave = 1) {
                const definition = GAME.ENEMIES[type];
                if (!definition) return null;
                const enemy = new Enemy(definition, wave);
                this.enemies.push(enemy);
                return enemy;
            }
            update(dt) {
                for (let i = this.enemies.length - 1; i >= 0; i--) {
                    const enemy = this.enemies[i];
                    enemy.update(dt);
                    if (enemy.distanceToCore <= GAME.CORE_RADIUS) {
                        this.enemies.splice(i, 1);
                        this.bus.emit(EVENTS.HULL.DAMAGE, { amount: enemy.damage, enemy });
                        continue;
                    }
                    if (!enemy.active) this.enemies.splice(i, 1);
                }
            }
            draw(ctx, toPx) { this.enemies.forEach(enemy => enemy.draw(ctx, toPx)); }
            get activeCount() { return this.enemies.length; }
        }

        // ==========================================================================
        // FILE: js/WaveManager.js
        // ==========================================================================
        class WaveManager {
            constructor(bus, enemyManager) {
                this.bus = bus;
                this.enemyManager = enemyManager;
                this.wave = 0;
                this.pending = [];
                this.spawnTimer = 0;
                this.running = false;
                this.advanceTimer = 0;
                this.bus.on(EVENTS.CORE.START, () => this.start());
                this.bus.on(EVENTS.HULL.FAILED, () => this.stop());
            }
            start() { this.running = true; this.startWave(1); }
            stop() { this.running = false; this.pending.length = 0; }
            startWave(wave) {
                this.wave = wave;
                const count = GAME.WAVE_BASE_COUNT + ((wave - 1) * GAME.WAVE_COUNT_GROWTH);
                this.pending = Array.from({ length: count }, (_, i) => i % 2 === 0 ? 'aeroDrone' : 'terraMole');
                this.spawnTimer = 0;
                this.advanceTimer = 0;
                this.bus.emit(EVENTS.WAVE.UPDATE, { wave });
                this.bus.emit(EVENTS.WAVE.START, { wave, count });
            }
            update(dt) {
                if (!this.running) return;
                if (this.pending.length > 0) {
                    this.spawnTimer -= dt;
                    if (this.spawnTimer <= 0) {
                        this.enemyManager.spawn(this.pending.shift(), this.wave);
                        this.spawnTimer = Math.max(0.45, GAME.WAVE_SPAWN_INTERVAL - (this.wave - 1) * 0.05);
                    }
                    return;
                }
                if (this.enemyManager.activeCount === 0) {
                    this.advanceTimer += dt;
                    if (this.advanceTimer >= 1.4) {
                        this.bus.emit(EVENTS.WAVE.CLEARED, { wave: this.wave });
                        this.startWave(this.wave + 1);
                    }
                } else {
                    this.advanceTimer = 0;
                }
            }
        }

        // ==========================================================================
        // FILE: js/CollisionSystem.js
        // ==========================================================================
        class CollisionSystem {
            constructor(bus, physics, enemyManager) {
                this.bus = bus;
                this.physics = physics;
                this.enemyManager = enemyManager;
            }
            update() {
                for (let pi = this.physics.projectiles.length - 1; pi >= 0; pi--) {
                    const projectile = this.physics.projectiles[pi];
                    const projectilePos = projectile.getCurrentPos();
                    const projectileStrata = projectile.k >= 0 ? 1 : -1;
                    for (let ei = this.enemyManager.enemies.length - 1; ei >= 0; ei--) {
                        const enemy = this.enemyManager.enemies[ei];
                        if (enemy.strata !== projectileStrata) continue;
                        if (Math.hypot(projectilePos.x - enemy.x, projectilePos.y - enemy.y) > GAME.COLLISION_RADIUS + enemy.radius) continue;
                        enemy.takeDamage(1);
                        this.physics.projectiles.splice(pi, 1);
                        this.bus.emit(EVENTS.FX.SHATTER, { x: enemy.x, y: enemy.y, k: enemy.y });
                        if (!enemy.active) {
                            this.enemyManager.enemies.splice(ei, 1);
                            this.bus.emit(EVENTS.SCORE.AWARD, { points: enemy.reward, credits: enemy.reward, enemy });
                        }
                        break;
                    }
                }
            }
        }

        // ==========================================================================
        // FILE: js/ScoreSystem.js
        // ==========================================================================
        class ScoreSystem {
            constructor(bus) {
                this.bus = bus;
                this.points = 0;
                this.credits = 100;
                this.bus.on(EVENTS.SCORE.AWARD, d => this.award(d));
            }
            award(data) {
                this.points += data.points || 0;
                this.credits += data.credits || 0;
                this.bus.emit(EVENTS.SCORE.UPDATE, { points: this.points, credits: this.credits });
            }
        }

        // ==========================================================================
        // FILE: js/HullSystem.js
        // ==========================================================================
        class HullSystem {
            constructor(bus) {
                this.bus = bus;
                this.maxHull = GAME.CORE_HULL;
                this.hull = this.maxHull;
                this.failed = false;
                this.bus.on(EVENTS.CORE.START, () => this.emitUpdate());
                this.bus.on(EVENTS.HULL.DAMAGE, d => this.damage(d.amount || 1));
            }
            damage(amount) {
                if (this.failed) return;
                this.hull = Math.max(0, this.hull - amount);
                this.emitUpdate();
                this.bus.emit(EVENTS.FX.SHAKE, { intensity: 10 });
                if (this.hull <= 0) {
                    this.failed = true;
                    this.bus.emit(EVENTS.HULL.FAILED);
                }
            }
            emitUpdate() { this.bus.emit(EVENTS.HULL.UPDATE, { hull: this.hull, maxHull: this.maxHull }); }
        }

        // ==========================================================================
        // FILE: js/Physics.js
        // ==========================================================================
        class PhysicsEngine {
            constructor(bus) {
                this.bus = bus; this.projectiles = []; this.lastH = 65; this.lastK = 15;
                this.heat = 0; this.isJammed = false; this.strataMode = 1; this.lockPeak = false; this.disabled = false;
                this.buffers = { shield: { time: 0, max: 10 }, regen: { time: 0, max: 10 }, cooling: { time: 0, max: 10 } };
                
                this.bus.on(EVENTS.INPUT.INTERACTION, d => {
                    let targetH = clamp(d.h, 0, 100); if (Math.abs(50 - targetH) < GAME.AIM_MARGIN) targetH = 50 + (targetH >= 50 ? GAME.AIM_MARGIN : -GAME.AIM_MARGIN);
                    this.lastH = targetH;
                    if ((this.strataMode === 1 && d.k > 0) || (this.strataMode === -1 && d.k < 0)) this.lockPeak = false;
                    if (!this.lockPeak) this.lastK = this.strataMode === 1 ? Math.max(2, d.k) : Math.min(-2, d.k);
                });
                
                this.bus.on(EVENTS.UI.ACTION, d => { 
                    if (d.type === 'fire') this.fire(); 
                    if (d.type === 'flip') this.flipStrata(); 
                });
                
                this.bus.on(EVENTS.SYSTEM.BUFF, d => {
                    if (this.buffers[d.type]) { this.buffers[d.type].time = d.duration || 10; this.buffers[d.type].max = this.buffers[d.type].time; }
                });
                this.bus.on(EVENTS.HULL.FAILED, () => { this.disabled = true; });
            }
            flipStrata() {
                this.strataMode *= -1; this.lockPeak = true;
                this.lastK = Math.max(2, Math.abs(this.lastK)) * this.strataMode;
                this.bus.emit(EVENTS.PHYSICS.FLIP, { mode: this.strataMode });
            }
            fire() {
                if (this.disabled) return;
                let h = this.lastH, k = this.lastK;
                if (this.isJammed) { h += (Math.random() - 0.5) * 40; k += (Math.random() - 0.5) * 20; }
                this.projectiles.push(new Projectile({x: 50, y: 0}, h, k, this.isJammed ? 'slag' : 'standard'));
                if (!this.isJammed) {
                    const heatMod = this.buffers.cooling.time > 0 ? 0.5 : 1.0;
                    this.heat = Math.min(100, this.heat + (12 * heatMod));
                    if (this.heat >= 100) { this.isJammed = true; this.bus.emit(EVENTS.PHYSICS.JAM, { active: true }); }
                    this.bus.emit(EVENTS.PHYSICS.HEAT, { heat: this.heat });
                }
            }
            update(dt) {
                const coolRate = this.buffers.cooling.time > 0 ? 32 : 12;
                if (this.heat > 0) {
                    this.heat -= dt * (this.isJammed ? 16 : coolRate);
                    if (this.isJammed && this.heat <= 0) { this.isJammed = false; this.bus.emit(EVENTS.PHYSICS.JAM, { active: false }); }
                    this.bus.emit(EVENTS.PHYSICS.HEAT, { heat: Math.max(0, this.heat) });
                }
                for (let key in this.buffers) {
                    if (this.buffers[key].time > 0) {
                        this.buffers[key].time -= dt;
                        if (this.buffers[key].time < 0) this.buffers[key].time = 0;
                    }
                }
                for (let i = this.projectiles.length - 1; i >= 0; i--) {
                    const p = this.projectiles[i];
                    p.update(dt);
                    if (!p.active) {
                        this.bus.emit(EVENTS.FX.SHATTER, { x: p.points[p.points.length - 1].x, y: 0, k: p.k });
                        this.projectiles.splice(i, 1);
                    }
                }
            }
        }

        // ==========================================================================
        // FILE: js/Input.js
        // ==========================================================================
        class InputTranslator {
            constructor(canvas, bus) {
                this.canvas = canvas;
                this.bus = bus;
                this.setup();
            }
            setup() {
                // AIMING HANDLER (NO FIRING)
                const handleAiming = (e) => {
                    // Prevent default to stop scrolling
                    if(e.cancelable) e.preventDefault();
                    
                    const rect = this.canvas.getBoundingClientRect();
                    let clientX, clientY;
                    
                    if (e.type.startsWith('touch')) {
                        // Use the first touch that targeted the canvas
                        const touch = e.targetTouches[0]; 
                        if (!touch) return;
                        clientX = touch.clientX;
                        clientY = touch.clientY;
                    } else {
                        clientX = e.clientX;
                        clientY = e.clientY;
                    }

                    const h = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
                    const k = clamp(30 - (((clientY - rect.top) / rect.height) * 60), -30, 30);
                    this.bus.emit(EVENTS.INPUT.INTERACTION, { h, k });
                };

                // Mouse Move for Aiming
                this.canvas.addEventListener('mousemove', handleAiming);
                
                // Touch: Aim ONLY, do not fire
                this.canvas.addEventListener('touchstart', handleAiming, { passive: false });
                this.canvas.addEventListener('touchmove', handleAiming, { passive: false });

                // Mouse Click still fires (Desktop Fallback)
                this.canvas.addEventListener('mousedown', (e) => {
                    if (e.button === 0) this.bus.emit(EVENTS.UI.ACTION, { type: 'fire' });
                    if (e.button === 2) this.bus.emit(EVENTS.UI.ACTION, { type: 'flip' });
                });

                this.canvas.addEventListener('contextmenu', e => e.preventDefault());
            }
        }

        // ==========================================================================
        // FILE: js/Orchestrator.js
        // ==========================================================================
        class Orchestrator {
            constructor(canvas, bus, physics, audio, particles, enemyManager, waveManager, collisionSystem) {
                this.canvas = canvas; this.ctx = canvas.getContext('2d');
                this.bus = bus; this.physics = physics; this.audio = audio; this.particles = particles;
                this.enemyManager = enemyManager; this.waveManager = waveManager; this.collisionSystem = collisionSystem;
                this.lastTime = 0; this.shakeAmount = 0; this.dpr = Math.min(window.devicePixelRatio || 1, 2);
                this.width = 0; this.height = 0; this.reduceMotion = false;
                this.state = 'SPLASH';
                
                window.addEventListener('resize', () => this.resize());
                this.resize();
                
                this.bus.on(EVENTS.CORE.START, () => {
                    if (this.state === 'RUNNING') return;
                    this.state = 'RUNNING';
                    const splash = document.getElementById('splash-screen');
                    if (splash) splash.style.display = 'none';
                    audio.init();
                    this.loop(0);
                });

                this.bus.on(EVENTS.FX.SHATTER, d => { const pos = this.toPx(d.x, d.y); this.particles.spawn(pos.x, pos.y, d.k > 0 ? '#00f3ff' : '#ff00ff', 15); });
                this.bus.on(EVENTS.FX.SHAKE, d => this.shakeAmount = Math.max(this.shakeAmount, d.intensity || 4));
                this.bus.on(EVENTS.HULL.FAILED, () => { this.state = 'GAME_OVER'; });
                this.bus.on(EVENTS.SYSTEM.SETTINGS, d => {
                    if (typeof d.reduceMotion !== 'undefined') this.reduceMotion = d.reduceMotion;
                });
            }
            resize() {
                const rect = this.canvas.parentElement.getBoundingClientRect();
                this.dpr = Math.min(window.devicePixelRatio || 1, 2);
                this.width = rect.width;
                this.height = rect.height;
                this.canvas.width = Math.floor(this.width * this.dpr);
                this.canvas.height = Math.floor(this.height * this.dpr);
                this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            }
            toPx(lx, ly) { 
                return { x: (lx / 100) * this.width, y: (1 - ((ly + 30) / 60)) * this.height }; 
            }
            loop(t) {
                if (this.state === 'SPLASH') return;
                const dt = Math.min((t - this.lastTime) / 1000, GAME.MAX_DT); this.lastTime = t;
                if (this.state === 'RUNNING') {
                    this.physics.update(dt);
                    this.enemyManager.update(dt);
                    this.collisionSystem.update(dt);
                    this.waveManager.update(dt);
                }
                this.particles.update(dt);
                if (this.shakeAmount > 0) this.shakeAmount -= dt * 15;
                this.draw(); requestAnimationFrame(t => this.loop(t));
            }
            draw() {
                const w = this.width, h = this.height, ctx = this.ctx;
                ctx.clearRect(0, 0, w, h); ctx.save();
                if (this.shakeAmount > 0 && !this.reduceMotion) ctx.translate((Math.random()-0.5)*this.shakeAmount, (Math.random()-0.5)*this.shakeAmount);
                ctx.fillStyle = '#0a0a12'; ctx.fillRect(0, 0, w, h / 2);
                ctx.fillStyle = '#140a12'; ctx.fillRect(0, h / 2, w, h / 2);
                ctx.strokeStyle = 'rgba(0, 243, 255, 0.05)'; ctx.lineWidth = 1;
                for(let i=0; i<=100; i+=10) { const p = this.toPx(i, 0); ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, h); ctx.stroke(); }
                for(let i=-30; i<=30; i+=10) { const p = this.toPx(0, i); ctx.beginPath(); ctx.moveTo(0, p.y); ctx.lineTo(w, p.y); ctx.stroke(); }
                ctx.strokeStyle = 'rgba(0, 243, 255, 0.4)'; ctx.beginPath(); ctx.moveTo(0, h/2); ctx.lineTo(w, h/2); ctx.stroke();

                const now = performance.now();
                const origin = this.toPx(50, 0); const rot = now * 0.001; const coreColor = this.physics.strataMode === 1 ? GAME.COLORS.cyan : GAME.COLORS.magenta;
                ctx.save(); ctx.translate(origin.x, origin.y);
                ctx.lineWidth = 2;
                if (this.physics.buffers.shield.time > 0) {
                    const p = this.physics.buffers.shield.time / this.physics.buffers.shield.max;
                    ctx.strokeStyle = 'rgba(0, 255, 100, 0.4)'; ctx.beginPath(); ctx.arc(0, 0, 36, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * p)); ctx.stroke();
                }
                if (this.physics.buffers.regen.time > 0) {
                    const p = this.physics.buffers.regen.time / this.physics.buffers.regen.max;
                    ctx.strokeStyle = 'rgba(0, 243, 255, 0.4)'; ctx.beginPath(); ctx.arc(0, 0, 32, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * p)); ctx.stroke();
                }
                if (this.physics.buffers.cooling.time > 0) {
                    const p = this.physics.buffers.cooling.time / this.physics.buffers.cooling.max;
                    ctx.strokeStyle = 'rgba(255, 140, 0, 0.4)'; ctx.beginPath(); ctx.arc(0, 0, 28, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * p)); ctx.stroke();
                }
                ctx.rotate(rot); ctx.strokeStyle = coreColor; ctx.lineWidth = 2; ctx.shadowBlur = 15; ctx.shadowColor = coreColor;
                const drawPoly = (r, sides) => {
                    ctx.beginPath(); for(let i = 0; i <= sides; i++) { const a = (i / sides) * Math.PI * 2; const px = Math.cos(a) * r, py = Math.sin(a) * r; if(i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
                    ctx.stroke(); ctx.globalAlpha = 0.1; ctx.fill(); ctx.globalAlpha = 1.0;
                };
                drawPoly(22, 13); ctx.rotate(-rot * 2.5); ctx.lineWidth = 1; drawPoly(8, 13);
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 1.5, 0, Math.PI*2); ctx.fill();
                ctx.restore(); ctx.shadowBlur = 0;

                const h_aim = this.physics.lastH, k_aim = this.physics.lastK;
                const aimDx = 50 - h_aim, denom = aimDx * aimDx, a_aim = denom === 0 ? 0 : -k_aim / denom;
                const peakPos = this.toPx(h_aim, k_aim);
                ctx.strokeStyle = Math.abs(k_aim) < 6 ? `rgba(255, ${Math.sin(now * 0.01) * 128 + 128}, 0, 1)` : (this.physics.strataMode === 1 ? GAME.COLORS.cyan : GAME.COLORS.magenta);
                ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(peakPos.x, peakPos.y, 10, 0, Math.PI * 2); ctx.stroke();
                ctx.beginPath(); ctx.setLineDash([4, 4]); ctx.strokeStyle = this.physics.isJammed ? 'rgba(255,0,0,0.4)' : (this.physics.strataMode === 1 ? 'rgba(0,243,255,0.3)' : 'rgba(255,0,255,0.3)');
                const xEnd = (2 * h_aim) - 50; const xRange = Math.abs(xEnd - 50), dir = h_aim >= 50 ? 1 : -1;
                for(let i=0; i<=60; i++) { const lx = 50 + (i / 60 * xRange * dir), ly = a_aim * (lx - h_aim) * (lx - h_aim) + k_aim, p = this.toPx(lx, ly); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
                ctx.stroke(); ctx.setLineDash([]);
                this.enemyManager.draw(ctx, (lx, ly) => this.toPx(lx, ly));
                this.physics.projectiles.forEach(p => {
                    const currentPos = p.getCurrentPos();
                    const pos = this.toPx(currentPos.x, currentPos.y);
                    ctx.fillStyle = p.type === 'slag' ? '#ff4400' : (p.k > 0 ? '#00f3ff' : '#ff00ff');
                    ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle; ctx.beginPath(); ctx.arc(pos.x, pos.y, 4, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
                });
                this.particles.draw(ctx); ctx.restore();
            }
        }

        // ==========================================================================
        // FILE: js/main.js
        // ==========================================================================
        window.onload = () => {
            window.bus = new EventBus(); const canvas = document.getElementById('gameCanvas'), audio = new AudioEngine(window.bus);
            const particles = new ParticleSystem(), physics = new PhysicsEngine(window.bus);
            const enemyManager = new EnemyManager(window.bus), waveManager = new WaveManager(window.bus, enemyManager);
            const collisionSystem = new CollisionSystem(window.bus, physics, enemyManager), scoreSystem = new ScoreSystem(window.bus), hullSystem = new HullSystem(window.bus);
            const engine = new Orchestrator(canvas, window.bus, physics, audio, particles, enemyManager, waveManager, collisionSystem);
            const input = new InputTranslator(canvas, window.bus);

            // Button Logic (Touch Enabled)
            document.querySelectorAll('.control-btn').forEach(b => {
                const trigger = (e) => {
                    if (e.cancelable) e.preventDefault(); 
                    e.stopPropagation();
                    audio.init(); 
                    window.bus.emit(EVENTS.UI.ACTION, { type: b.dataset.action }); 
                };
                b.addEventListener('touchstart', trigger, { passive: false });
                b.addEventListener('mousedown', trigger); // Mouse fallback
            });
            
            // Settings UI
            document.getElementById('btn-settings').addEventListener('click', (e) => {
                e.stopPropagation();
                document.getElementById('settings-drawer').classList.add('open');
            });
            document.getElementById('close-settings').addEventListener('click', (e) => {
                e.stopPropagation();
                document.getElementById('settings-drawer').classList.remove('open');
            });
            document.getElementById('volume-slider').addEventListener('input', (e) => {
                const val = e.target.value;
                document.getElementById('volume-display').innerText = val + '%';
                window.bus.emit(EVENTS.SYSTEM.SETTINGS, { volume: val / 100 });
            });
            document.getElementById('music-toggle').addEventListener('change', (e) => {
                window.bus.emit(EVENTS.SYSTEM.SETTINGS, { music: e.target.checked });
            });
            document.getElementById('photosensitive-toggle').addEventListener('change', (e) => {
                document.body.classList.toggle('reduce-flash', e.target.checked);
                window.bus.emit(EVENTS.SYSTEM.SETTINGS, { reduceMotion: e.target.checked });
            });
            
            // Splash Button
            document.getElementById('btn-init').addEventListener('click', () => {
                window.bus.emit(EVENTS.CORE.START);
            });

            window.addEventListener('keydown', e => {
                if (e.shiftKey && e.key.toLowerCase() === 'd') document.getElementById('debug-console').style.display = document.getElementById('debug-console').style.display === 'block' ? 'none' : 'block';
                if (e.key === 'Escape') document.getElementById('debug-console').style.display = 'none';
            });
            document.getElementById('debug-heat-spike').onclick = () => window.bus.emit(EVENTS.PHYSICS.HEAT, {heat: 100});
            document.getElementById('debug-clear-heat').onclick = () => window.bus.emit(EVENTS.PHYSICS.HEAT, {heat: 0});
            document.getElementById('debug-system-failure').onclick = () => {
                window.bus.emit(EVENTS.PHYSICS.HEAT, {heat: 100}); window.bus.emit(EVENTS.FX.SHAKE, {intensity: 12});
                const alertEl = document.getElementById('status-alert'), countdownEl = document.getElementById('countdown');
                if (alertEl) alertEl.innerText = "CRITICAL: SYSTEM FAILURE"; if (countdownEl) countdownEl.innerText = "HARDWARE TERMINATED";
            };
            document.getElementById('debug-activate-shield').onclick = () => window.bus.emit(EVENTS.SYSTEM.BUFF, {type: 'shield', duration: 10});
            document.getElementById('debug-activate-regen').onclick = () => window.bus.emit(EVENTS.SYSTEM.BUFF, {type: 'regen', duration: 10});
            document.getElementById('debug-activate-cooling').onclick = () => window.bus.emit(EVENTS.SYSTEM.BUFF, {type: 'cooling', duration: 10});

            window.bus.on(EVENTS.WAVE.UPDATE, d => {
                const waveEl = document.getElementById('wave-num'), statusEl = document.getElementById('status-alert'), countdownEl = document.getElementById('countdown');
                if (waveEl) waveEl.innerText = String(d.wave).padStart(2, '0');
                if (statusEl) { statusEl.innerText = `Wave ${d.wave}: Hostiles inbound`; statusEl.classList.remove('text-red-500'); }
                if (countdownEl) { countdownEl.innerText = 'SECURE ORIGIN'; countdownEl.className = 'text-2xl sm:text-4xl font-bold tracking-tighter neon-text-magenta leading-none mb-1 whitespace-nowrap'; }
            });
            window.bus.on(EVENTS.SCORE.UPDATE, d => {
                const pointsEl = document.getElementById('points'), creditsEl = document.getElementById('credits');
                if (pointsEl) pointsEl.innerText = String(d.points).padStart(5, '0');
                if (creditsEl) creditsEl.innerText = d.credits;
            });
            window.bus.on(EVENTS.HULL.UPDATE, d => {
                const hpEl = document.getElementById('hp-value'), hullBar = document.getElementById('hull-bar');
                if (hpEl) hpEl.innerText = d.hull.toFixed(1);
                if (hullBar) {
                    const active = Math.ceil(d.hull);
                    Array.from(hullBar.children).forEach((segment, i) => segment.classList.toggle('active-hp', i < active));
                }
            });
            window.bus.on(EVENTS.HULL.FAILED, () => {
                const statusEl = document.getElementById('status-alert'), countdownEl = document.getElementById('countdown');
                if (statusEl) { statusEl.innerText = 'CRITICAL: CORE BREACHED'; statusEl.classList.add('text-red-500'); }
                if (countdownEl) { countdownEl.innerText = 'DEFENSE FAILED'; countdownEl.className = 'text-2xl sm:text-4xl font-bold tracking-tighter leading-none mb-1 jam-flicker'; }
            });

            window.bus.on(EVENTS.PHYSICS.HEAT, d => {
                const valEl = document.getElementById('heat-value'), segs = document.getElementById('heat-bar').children;
                if (valEl) valEl.innerText = `${Math.floor(d.heat)}%`;
                for(let i=0; i<segs.length; i++) i < Math.floor(d.heat/10) ? segs[i].classList.add('active-heat') : segs[i].classList.remove('active-heat');
                if (d.heat >= 100) physics.isJammed = true;
            });
            window.bus.on(EVENTS.PHYSICS.FLIP, d => {
                const el = document.getElementById('current-strata');
                if (el) { el.innerText = `Strata: ${d.mode === 1 ? 'Upper' : 'Lower'}`; el.className = `text-[10px] sm:text-[12px] font-bold mb-1 tracking-widest uppercase ${d.mode === 1 ? 'neon-text-cyan' : 'neon-text-magenta'}`; }
            });
            window.bus.on(EVENTS.PHYSICS.JAM, d => {
                const statusEl = document.getElementById('status-alert'), countdownEl = document.getElementById('countdown');
                if (statusEl) { statusEl.innerText = d.active ? 'Critical: Jammed' : 'Systems: Nominal'; statusEl.classList.toggle('text-red-500', d.active); }
                if (countdownEl) { countdownEl.innerText = d.active ? "HARDWARE JAM" : "SECURE ORIGIN"; countdownEl.className = `text-2xl sm:text-4xl font-bold tracking-tighter leading-none mb-1 ${d.active ? 'jam-flicker' : 'neon-text-magenta'}`; }
            });
        };
