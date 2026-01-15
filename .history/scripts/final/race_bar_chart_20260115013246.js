(function() {
    // ==========================================
    // --- 1. CONFIGURAZIONE ---
    // ==========================================
    const path = "../../data/final/FlightsUKR/fly/race_bar.csv"; 
    
    const codeToName = {
        "UA": "Ukraine", "RU": "Russia", "PL": "Poland", "RO": "Romania", 
        "HU": "Hungary", "SK": "Slovakia", "LT": "Lithuania",
        "MD": "Moldova", "BY": "Belarus", "DE": "Germany", "TR": "Turkey"
    };

    // VELOCITÀ: 40000 = 40 secondi
    const duration = 40000; 
    
    const k = 10;           
    const width = 1000;
    const barSize = 48;
    const margin = { top: 16, right: 6, bottom: 6, left: 160 }; 

    const customPalette = ["#003f5c", "#374c80", "#7a5195", "#bc5090", "#ef5675", "#ff764a", "#ffa600"];
    const neigh = ["Russia", "Ukraine", "Poland", "Hungary", "Romania", "Lithuania", "Slovakia"];

    // Variabili di Stato
    let n, height, svg, keyframes;
    let globalMax; 
    let isAnimationRunning = false; 

    // ==========================================
    // --- 2. CARICAMENTO DATI ---
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

        // --- INIZIALIZZAZIONE UI ---
        setupReplayButton(); // Collega il tasto Replay esistente
        setupHelp();         // RIEMPIE IL DIV #race-help-container

        // --- AVVIO GRAFICO ---
        initChart();
        runAnimation();

    }).catch(err => {
        console.error("ERRORE CARICAMENTO:", err);
        d3.select("#race-chart-container").html(`<p style="color:red; text-align:center;">Errore caricamento: ${path}</p>`);
    });


    // ==========================================
    // --- 3. DISEGNO GRAFICO (INIT) ---
    // ==========================================
    function initChart() {
        d3.select("#race-chart-container svg").remove();
        
        svg = d3.select("#race-chart-container").append("svg")
            .attr("viewBox", [0, 0, width, height]);

        // Assi e Gruppi
        svg.append("g").attr("class", "axis axis--top").attr("transform", `translate(0,${margin.top})`);
        svg.append("g").attr("class", "bars");
        svg.append("g").attr("class", "labels-name");
        svg.append("g").attr("class", "labels-value");
        
        // Ticker Anno
        svg.append("text")
            .attr("class", "year-ticker")
            .attr("x", width - 60)
            .attr("y", height - 30)
            .style("font-size", "24px") 
            .style("opacity", 0.6)
            .style("font-weight", "bold")
            .attr("text-anchor", "end")
            .text("");
    }

    // ==========================================
    // --- 4. ANIMAZIONE (LOOP) ---
    // ==========================================
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
            if (!isAnimationRunning) break; 

            const transition = svg.transition().duration(duration / keyframes.length).ease(d3.easeLinear);
            const [date, data] = keyframe;

            // Rettangoli
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

            // Nomi
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

            // Valori
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
            try { await transition.end(); } catch(e) { }
        }
    }

    // ==========================================
    // --- 5. FUNZIONI DATI ---
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
    // --- 6. GESTIONE UI (HELP & REPLAY) ---
    // ==========================================
    
    // --- A. REPLAY ---
    function setupReplayButton() {
        // Funzione trigger interna
        const triggerReplay = () => {
            if(svg && keyframes) {
                isAnimationRunning = false; 
                svg.selectAll("*").interrupt(); 
                setTimeout(() => {
                    initChart();
                    runAnimation();
                }, 50);
            }
        };

        // Assegna globale (per l'HTML onclick="replay()")
        window.replay = triggerReplay;

        // Assegna listener JS (per sicurezza, se onclick fallisce)
        const btn = document.getElementById("replay-btn");
        if(btn) {
            btn.onclick = null;
            btn.addEventListener("click", function(e) {
                e.preventDefault();
                triggerReplay();
            });
        }
    }

    // --- B. HELP (Inserisce il bottone nel div #race-help-container) ---
    function setupHelp() {
        const container = document.getElementById("race-help-container");
        if (!container) {
            console.warn("Container #race-help-container non trovato nell'HTML.");
            return;
        }

        // Inseriamo l'HTML del bottone e dell'overlay direttamente nel contenitore
        // Usiamo le classi che hai già nel CSS (.chart-help-trigger, .chart-help-overlay)
        container.innerHTML = `
            <div class="chart-help-trigger" style="cursor: pointer; display: inline-flex; align-items: center; gap: 8px; padding: 5px; border-radius: 4px; background: #fff; border: 1px solid #ddd;">
                <span class="chart-help-icon" style="background: #343a40; color: white; border-radius: 50%; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; font-family: serif; font-weight: bold; font-style: italic;">i</span>
                <span class="chart-help-text" style="font-weight: bold; font-size: 13px; color: #333;">How to read this chart</span>
            </div>

            <div class="chart-help-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.95); z-index: 9999; align-items: center; justify-content: center;">
                <div class="chart-help-content" style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 5px 20px rgba(0,0,0,0.2); max-width: 400px; text-align: center; border: 1px solid #ccc;">
                    <h3 style="margin-top: 0; color: #333;">Bar Chart Race</h3>
                    <div style="height: 3px; width: 50px; background: #C8102E; margin: 15px auto;"></div>
                    <ul style="text-align: left; font-size: 14px; line-height: 1.6; color: #555;">
                        <li><strong>Barre:</strong> Rappresentano il volume di voli per destinazione.</li>
                        <li><strong>Classifica:</strong> I paesi cambiano posizione in base al volume mensile.</li>
                        <li><strong>Numeri:</strong> Totale voli per quel mese specifico.</li>
                    </ul>
                    <p style="font-size: 12px; color: #999; margin-top: 20px; cursor: pointer;">(Clicca ovunque per chiudere)</p>
                </div>
            </div>
        `;

        // Logica click
        const trigger = container.querySelector(".chart-help-trigger");
        const overlay = container.querySelector(".chart-help-overlay");

        if (trigger && overlay) {
            trigger.addEventListener("click", () => {
                overlay.style.display = "flex"; // Mostra
            });
            overlay.addEventListener("click", () => {
                overlay.style.display = "none"; // Nascondi
            });
        }
    }

})();