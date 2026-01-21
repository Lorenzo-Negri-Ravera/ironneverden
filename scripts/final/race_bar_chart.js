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

    const duration = 40000; 
    const k = 10;           
    const width = 1000;
    const barSize = 50;     
    
    // MODIFICA QUI: Aumentato margin.right a 120 per far stare le etichette
    const margin = { top: 60, right: 120, bottom: 10, left: 140 }; 

    const customPalette = ["#003f5c", "#374c80", "#7a5195", "#bc5090", "#ef5675", "#ff764a", "#ffa600"];
    const neigh = ["Russia", "Ukraine", "Poland", "Hungary", "Romania", "Lithuania", "Slovakia"];

    let currentRaceId = 0;

    // ==========================================
    // --- 2. INIT OBSERVER ---
    // ==========================================
    document.addEventListener("DOMContentLoaded", function() {
        const target = document.querySelector("#race-chart-section");
        if(target) {
            const observer = new IntersectionObserver((entries, obs) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        startRaceChart(); 
                        obs.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1 });
            observer.observe(target);
        }
    });

    // ==========================================
    // --- 3. LOGICA PRINCIPALE ---
    // ==========================================
    function startRaceChart() {
        const myRaceId = ++currentRaceId;
        const container = d3.select("#race-chart-container");
        container.selectAll("*").remove(); 

        d3.csv(path).then(function(rawData) {
            
            if (currentRaceId !== myRaceId) return; 

            let data = processHybridData(rawData);
            data = data.filter(d => neigh.includes(d.name));

            if (data.length === 0) return;

            const names = new Set(data.map(d => d.name));
            const n = names.size;
            
            const height = margin.top + barSize * n + margin.bottom;
            const globalMax = d3.max(data, d => d.value);

            const dateValues = Array.from(d3.rollup(data, ([d]) => d.value, d => d.date, d => d.name))
                .map(([date, data]) => [new Date(date), data])
                .sort(([a], [b]) => d3.ascending(a, b));

            let keyframes = [];
            let ka, a, kb, b;
            for ([[ka, a], [kb, b]] of d3.pairs(dateValues)) {
                for (let i = 0; i < k; ++i) {
                    const t = i / k;
                    keyframes.push([
                        new Date(ka * (1 - t) + kb * t),
                        rank(name => (a.get(name) || 0) * (1 - t) + (b.get(name) || 0) * t, names, n)
                    ]);
                }
            }
            if(kb) keyframes.push([new Date(kb), rank(name => b.get(name) || 0, names, n)]);

            const svg = container.append("svg")
                .attr("viewBox", [0, 0, width, height])
                .style("width", "100%")
                .style("height", "auto")
                .style("display", "block");

            setupUI();
            runAnimation(svg, keyframes, n, height, globalMax, myRaceId);

        }).catch(err => {
            console.error("Errore Race Chart:", err);
            container.html(`<div class="alert alert-danger">Error loading data</div>`);
        });
    }

    // ==========================================
    // --- 4. ANIMAZIONE ---
    // ==========================================
    async function runAnimation(svg, keyframes, n, height, globalMax, myRaceId) {
        
        // MODIFICA QUI: Aggiunto * 1.05 per dare un po' di "respiro" alla barra più lunga
        const x = d3.scaleLinear([0, globalMax * 1.05], [margin.left, width - margin.right]);
        
        const y = d3.scaleBand()
            .domain(d3.range(n + 2)) 
            .rangeRound([margin.top, margin.top + barSize * (n + 2)])
            .padding(0.1);

        const colorScale = d3.scaleOrdinal(customPalette).domain(neigh);
        const getColor = (name) => colorScale(name) || "#ccc";
        const formatNumber = d3.format(",d");
        const formatDate = d3.utcFormat("%B %Y");

        const gAxis = svg.append("g").attr("class", "axis axis--top").attr("transform", `translate(0,${margin.top})`);
        const gBars = svg.append("g").attr("class", "bars");
        const gLabels = svg.append("g").attr("class", "labels");
        
        const dateLabel = svg.append("text")
            .attr("class", "year-ticker")
            .attr("x", width - 40)
            .attr("y", height - 30)
            .style("font-family", "'Roboto Slab', serif")
            .style("font-size", "48px")
            .style("font-weight", "700")
            .style("fill", "#e0e0e0")
            .style("opacity", 0.8)
            .attr("text-anchor", "end");

        // DISEGNO INIZIALE ASSE
        gAxis.call(d3.axisTop(x)
                .ticks(width / 160)
                .tickSizeOuter(0)
                .tickSizeInner(- (barSize * (n + 2))) 
            )
            .call(g => g.select(".domain").remove())
            .call(g => g.selectAll(".tick line")
                .attr("stroke-opacity", 0.4)
                .attr("stroke-dasharray", "2,2")
                .attr("stroke", "#ccc")
            )
            .selectAll("text")
            .style("font-family", "'Fira Sans', sans-serif")
            .style("font-size", "12px");

        for (const keyframe of keyframes) {
            if (currentRaceId !== myRaceId) return; 

            const transition = svg.transition().duration(duration / keyframes.length).ease(d3.easeLinear);
            const [date, data] = keyframe;

            // --- BARRE ---
            gBars.selectAll("rect")
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

            // --- LABELS (Nomi) ---
            gLabels.selectAll("text.label-name")
                .data(data.slice(0, n), d => d.name)
                .join(
                    enter => enter.append("text")
                        .attr("class", "label-name")
                        .attr("text-anchor", "end")
                        .attr("x", margin.left - 10) 
                        .attr("y", d => y(n + 1) + y.bandwidth() / 2) 
                        .attr("dy", "0.35em")
                        .style("font-family", "'Fira Sans', sans-serif")
                        .style("font-weight", "bold")
                        .style("font-size", "14px")
                        .text(d => d.name),
                    update => update,
                    exit => exit.transition(transition).remove()
                        .attr("y", d => y(n + 1) + y.bandwidth() / 2)
                )
                .call(text => text.transition(transition)
                    .attr("y", d => y(d.rank) + y.bandwidth() / 2)
                );

            // --- VALUES (Numeri) ---
            gLabels.selectAll("text.label-value")
                .data(data.slice(0, n), d => d.name)
                .join(
                    enter => enter.append("text")
                        .attr("class", "label-value")
                        .attr("text-anchor", "start")
                        .attr("x", d => x(d.value) + 8) 
                        .attr("y", d => y(n + 1) + y.bandwidth() / 2) 
                        .attr("dy", "0.35em")
                        .style("font-family", "'Fira Sans', sans-serif")
                        .style("font-size", "14px")
                        .style("font-variant-numeric", "tabular-nums")
                        .text(d => formatNumber(d.value)),
                    update => update,
                    exit => exit.transition(transition).remove()
                        .attr("x", d => x(d.value) + 8)
                        .attr("y", d => y(n + 1) + y.bandwidth() / 2)
                )
                .call(text => text.transition(transition)
                    .attr("x", d => x(d.value) + 8)
                    .attr("y", d => y(d.rank) + y.bandwidth() / 2)
                    .tween("text", function(d) {
                        const i = d3.interpolateNumber(this.textContent.replace(/,/g, "") || 0, d.value);
                        return function(t) { this.textContent = formatNumber(i(t)); };
                    })
                );

            dateLabel.text(formatDate(date));
            try { await transition.end(); } catch(e) { return; }
        }
    }

    // ==========================================
    // --- 5. UTILS DATI ---
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

    function rank(value, names, n) {
        const data = Array.from(names, name => ({name, value: value(name)}));
        data.sort((a, b) => d3.descending(a.value, b.value));
        for (let i = 0; i < data.length; ++i) data[i].rank = Math.min(n, i);
        return data;
    }

    // ==========================================
    // --- 6. SETUP UI ---
    // ==========================================
    function setupUI() {
        window.replay = function() {
            startRaceChart();
        };

        if (typeof createChartHelp === "function") {
            createChartHelp("#race-help-container", "#race-chart-wrapper", {
                title: "How to read the Race Chart",
                steps: [
                    "<strong>Bars:</strong> Represent flight volume per destination.",
                    "<strong>Rank:</strong> Watch countries rise and fall in rank over time.",
                    "<strong>Replay:</strong> Use the button to restart the animation."
                ]
            });
        }
    }

})();