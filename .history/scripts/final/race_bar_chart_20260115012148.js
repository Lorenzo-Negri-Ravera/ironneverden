(function() {
    // ==========================================
    // --- CONFIGURAZIONE ---
    // ==========================================
    const path = "../../data/final/FlightsUKR/fly/race_bar.csv"; 
    
    const codeToName = {
        "UA": "Ukraine", "RU": "Russia", "PL": "Poland", "RO": "Romania", 
        "HU": "Hungary", "SK": "Slovakia", "LT": "Lithuania",
        "MD": "Moldova", "BY": "Belarus", "DE": "Germany", "TR": "Turkey"
    };

    const duration = 20000; 
    const k = 10;           
    const width = 1000;
    const barSize = 48;
    const margin = { top: 16, right: 6, bottom: 6, left: 160 }; 

    const customPalette = ["#003f5c", "#374c80", "#7a5195", "#bc5090", "#ef5675", "#ff764a", "#ffa600"];
    const neigh = ["Russia", "Ukraine", "Poland", "Hungary", "Romania", "Lithuania", "Slovakia"];

    // Variabili di stato
    let n, height, svg, keyframes;
    let globalMax;
    let isAnimationRunning = false; // Flag per evitare click multipli o sovrapposizioni

    // ==========================================
    // --- CARICAMENTO DATI ---
    // ==========================================
    d3.csv(path).then(function(rawData) {

        let data = processHybridData(rawData);
        data = data.filter(d => neigh.includes(d.name));

        if (data.length === 0) {
            console.error("Race Chart: Dati vuoti.");
            return;
        }

        const names = new Set(data.map(d => d.name));
        n = names.size;
        height = margin.top + barSize * n + margin.bottom;
        globalMax = d3.max(data, d => d.value);

        const dateValues = Array.from(d3.rollup(data, ([d]) => d.value, d => d.date, d => d.name))
            .map(([date, data]) => [new Date(date), data])
            .sort(([a], [b]) => d3.ascending(a, b));

        keyframes = [];
        let ka, a, kb, b;
        for ([[ka, a], [kb, b]] of d3.pairs(dateValues)) {
            for (let i = 0; i < k; ++i) {
                const t = i / k;
                keyframes.push([
                    new Date(ka * (1 - t) + kb * t),
                    rank(name => (a.get(name) || 0) * (1 - t) + (b.get(name) || 0) * t, names)
                ]);
            }
        }
        if(kb) keyframes.push([new Date(kb), rank(name => b.get(name) || 0, names)]);

        // 1. Inizializza Help
        setupHelp(); 
        
        // 2. Inizializza Replay Button (LA CORREZIONE È QUI)
        setupReplayButton();

        // 3. Avvia grafico
        initChart();
        runAnimation();

    }).catch(err => {
        console.error("ERRORE CARICAMENTO:", err);
        d3.select("#race-chart-container").html(`<p style="color:red; text-align:center;">Errore caricamento: ${path}</p>`);
    });

    // ==========================================
    // --- LOGICA DI DISEGNO ---
    // ==========================================
    function initChart() {
        d3.select("#race-chart-container svg").remove();
        
        svg = d3.select("#race-chart-container").append("svg")
            .attr("viewBox", [0, 0, width, height]);

        svg.append("g").attr("class", "axis axis--top").attr("transform", `translate(0,${margin.top})`);
        svg.append("g").attr("class", "bars");
        svg.append("g").attr("class", "labels-name");
        svg.append("g").attr("class", "labels-value");
        
        svg.append("text")
            .attr("class", "year-ticker")
            .attr("x", width - 60).attr("y", height - 30)
            .text("");
    }

    async function runAnimation() {
        if (!svg) return;
        isAnimationRunning = true;

        const x = d3.scaleLinear([0, globalMax], [margin.left, width - margin.right]);
        const y = d3.scaleBand()
            .domain(d3.range(n + 2))
            .rangeRound([margin.top, margin.top + barSize * (n + 2 + 0.1)])
            .padding(0.1);
        
        const colorScale = d3.scaleOrdinal(customPalette).domain(neigh);
        const getColor = (name) => colorScale(name) || "#ccc";
        const formatNumber = d3.format(",d");
        const formatDate = d3.utcFormat("%B %Y"); 

        svg.select(".axis--top")
            .call(d3.axisTop(x).ticks(width / 160).tickSizeOuter(0).tickSizeInner(-barSize * (n + y.padding())));
        svg.select(".axis--top .domain").remove();

        for (const keyframe of keyframes) {
            // Se l'animazione è stata fermata (perché abbiamo cliccato replay), usciamo dal loop
            if (!isAnimationRunning) break; 

            const transition = svg.transition().duration(duration / keyframes.length).ease(d3.easeLinear);
            const [date, data] = keyframe;

            svg.select(".bars").selectAll("rect")
                .data(data.slice(0, n), d => d.name)
                .join(
                    enter => enter.append("rect")
                        .attr("fill", d => getColor(d.name))
                        .attr("height", y.bandwidth())
                        .attr("x", x(0))
                        .attr("y", d => y(n + 1))
                        .attr("width", d => x(d.value) - x(0)),
                    update => update,
                    exit => exit.transition(transition).remove()
                        .attr("y", d => y(n + 1))
                        .attr("width", d => x(d.value) - x(0))
                )
                .call(bar => bar.transition(transition)
                    .attr("y", d => y(d.rank))
                    .attr("width", d => x(d.value) - x(0))
                    .attr("fill", d => getColor(d.name))
                );

            svg.select(".labels-name").selectAll("text")
                .data(data.slice(0, n), d => d.name)
                .join(
                    enter => enter.append("text")
                        .attr("text-anchor", "end")
                        .attr("x", margin.left - 10)
                        .attr("y", d => y(n + 1) + y.bandwidth() / 2)
                        .attr("dy", "0.35em")
                        .text(d => d.name),
                    update => update,
                    exit => exit.transition(transition).remove()
                        .attr("y", d => y(n + 1) + y.bandwidth() / 2)
                )
                .call(text => text.transition(transition)
                    .attr("y", d => y(d.rank) + y.bandwidth() / 2)
                    .style("font-weight", "bold")
                );

            svg.select(".labels-value").selectAll("text")
                .data(data.slice(0, n), d => d.name)
                .join(
                    enter => enter.append("text")
                        .attr("text-anchor", "start")
                        .attr("x", d => x(d.value) + 6)
                        .attr("y", d => y(n + 1) + y.bandwidth() / 2)
                        .attr("dy", "0.35em")
                        .text(d => formatNumber(d.value)),
                    update => update,
                    exit => exit.transition(transition).remove()
                        .attr("x", d => x(d.value) + 6)
                        .attr("y", d => y(n + 1) + y.bandwidth() / 2)
                )
                .call(text => text.transition(transition)
                    .attr("x", d => x(d.value) + 6)
                    .attr("y", d => y(d.rank) + y.bandwidth() / 2)
                    .tween("text", function(d) {
                        const i = d3.interpolateNumber(this.textContent.replace(/,/g, "") || 0, d.value);
                        return function(t) { this.textContent = formatNumber(i(t)); };
                    })
                );

            svg.select(".year-ticker").text(formatDate(date));
            try {
                await transition.end();
            } catch(e) {
                // Gestisce l'interruzione della transizione senza errori in console
            }
        }
    }

    // ==========================================
    // --- FUNZIONI DI SUPPORTO ---
    // ==========================================
    function processHybridData(data) {
        const output = [];
        const years = [2019, 2020, 2021, 2022]; 

        data.forEach(row => {
            const destCode = row.destination_name;
            const destName = codeToName[destCode] || destCode; 
            const monthIndex = parseInt(row.mese_id) - 1;

            if (isNaN(monthIndex)) return; 

            years.forEach(year => {
                const colName = `flights_${year}`; 
                const val = parseFloat(row[colName]);

                if (!isNaN(val)) {
                    output.push({
                        name: destName,
                        date: new Date(year, monthIndex, 1),
                        value: val
                    });
                }
            });
        });
        return output.sort((a, b) => a.date - b.date);
    }

    function rank(value, names) {
        const data = Array.from(names, name => ({name, value: value(name)}));
        data.sort((a, b) => d3.descending(a.value, b.value));
        for (let i = 0; i < data.length; ++i) data[i].rank = Math.min(n, i);
        return data;
    }

    // ==========================================
    // --- GESTIONE REPLAY (ROBUSTA) ---
    // ==========================================
    function setupReplayButton() {
        const btn = document.getElementById("replay-btn");
        
        // Funzione interna di replay
        const triggerReplay = () => {
            if(svg && keyframes) {
                // Ferma l'animazione corrente
                isAnimationRunning = false; 
                svg.selectAll("*").interrupt(); 
                
                // Piccolo timeout per dare tempo al loop di fermarsi
                setTimeout(() => {
                    initChart();
                    runAnimation();
                }, 50);
            }
        };

        // 1. Assegna Globale (per sicurezza HTML onclick)
        window.replay = triggerReplay;

        // 2. Assegna Event Listener JS (per sicurezza CSS/DOM)
        if(btn) {
            // Rimuovi eventuali listener precedenti per non duplicare
            btn.removeEventListener("click", triggerReplay);
            btn.addEventListener("click", triggerReplay);
        } else {
            console.warn("Bottone #replay-btn non trovato nel DOM");
        }
    }


    // ==========================================
    // --- GESTIONE HELP ---
    // ==========================================
    function setupHelp() {
        const helpContainer = document.getElementById("race-help-container");
        if (!helpContainer) return;

        helpContainer.innerHTML = `
            <div class="chart-help-trigger" style="cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <span class="chart-help-icon" style="background: black; color: white; border-radius: 50%; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; font-family: serif; font-weight: bold; font-style: italic;">i</span>
                <span class="chart-help-text" style="font-weight: bold;">How to read this chart</span>
            </div>
            <div class="chart-help-overlay" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.95); z-index: 5000; align-items: center; justify-content: center;">
                <div class="chart-help-content" style="background: white; padding: 20px; border: 1px solid #ccc; border-radius: 8px; text-align: center; max-width: 300px;">
                    <h3>Bar Chart Race</h3>
                    <div style="height: 2px; width: 40px; background: red; margin: 10px auto;"></div>
                    <ul style="text-align: left; font-size: 13px;">
                        <li><strong>Barre:</strong> Evoluzione dei voli nel tempo.</li>
                        <li><strong>Ordine:</strong> I paesi cambiano posizione in classifica.</li>
                        <li><strong>Numeri:</strong> Voli totali per quel mese.</li>
                    </ul>
                    <p style="font-size: 11px; color: #888; margin-top: 10px; cursor: pointer;">(Clicca per chiudere)</p>
                </div>
            </div>
        `;

        const trigger = helpContainer.querySelector(".chart-help-trigger");
        const overlay = helpContainer.querySelector(".chart-help-overlay");

        if (trigger && overlay) {
            trigger.addEventListener("click", () => {
                overlay.style.display = "flex";
            });
            overlay.addEventListener("click", () => {
                overlay.style.display = "none";
            });
        }
    }

})();