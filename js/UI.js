class UIController {
            constructor(bus) {
                this.bus = bus;
                this.elements = {
                    heatValue: document.getElementById('heat-value'),
                    heatBar: document.getElementById('heat-bar'),
                    jamWarning: document.getElementById('jam-warning'),
                    statusAlert: document.getElementById('status-alert')
                };
                this.init();
            }
            init() {
                this.bus.on('HEAT_UPDATE', (payload) => {
                    const { heat } = payload;
                    this.elements.heatValue.innerText = `${Math.floor(heat)}%`;
                    const segments = this.elements.heatBar.children;
                    const activeCount = Math.floor(heat / 10);
                    for(let i = 0; i < segments.length; i++) {
                        if (i < activeCount) segments[i].classList.add('active-heat');
                        else segments[i].classList.remove('active-heat');
                    }
                });

                this.bus.on('JAM_STATE', (payload) => {
                    if (payload.active) {
                        this.elements.jamWarning.classList.remove('hidden');
                        this.elements.statusAlert.innerText = 'CRITICAL: HARDWARE JAM';
                        this.elements.statusAlert.classList.add('text-red-500');
                    } else {
                        this.elements.jamWarning.classList.add('hidden');
                        this.elements.statusAlert.innerText = 'Systems: Nominal';
                        this.elements.statusAlert.classList.remove('text-red-500');
                    }
                });

                document.querySelectorAll('.control-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        this.bus.emit('UI_ACTION', { type: btn.dataset.action });
                    });
                });
            }
        }
