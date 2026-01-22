// gas_hist.js

(function() {

    // --- CONFIGURAZIONE ---
    const CSV_PATH = "../../data/final/trade-data/final_datasets/gas_price.csv"; 
    const LINE_COLOR = "#ff7c43"; //"#e6550d"; 

    document.addEventListener("DOMContentLoaded", function() {
        const target = document.querySelector("#gas-linechart-section");
        
        if(target) {
            const observer = new IntersectionObserver((entries, obs) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        initGasBarChart();
                        obs.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.5 });

            observer.observe(target);
        }
    });

    function parseSemester(timeStr) {
        const [year, sem] = timeStr.split("-");
        const month = sem === "S1" ? 0 : 6; 
        return new Date(year, month, 1);
    }

    async function initGasBarChart() {
        const container = d3.select("#gas-linechart-container");
        
        d3.select("#gas-linechart-legend-container").html("");
        d3.select("#gas-linechart-tooltip").style("visibility", "hidden");
        
        if (container.empty()) return;

        container.html("");
        container.attr("style", ""); 

        // 1. MARGINI STANDARD (Uniformità con gli altri grafici)
        const margin = {top: 40, right: 30, bottom: 40, left: 50};
        const width = 1000 - margin.left - margin.right;
        const height = 500 - margin.top - margin.bottom;

        // Il container ha già la classe .chart-theme-universal (da HTML)
        const svg = container.append("svg")
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        try {
            const data = await d3.csv(CSV_PATH, d => ({
                date: parseSemester(d.TIME_PERIOD),
                originalPeriod: d.TIME_PERIOD,
                value: +d.OBS_VALUE
            }));

            data.sort((a, b) => a.date - b.date);

            // --- SCALE ---
            const x = d3.scaleBand()
                .domain(data.map(d => d.originalPeriod))
                .range([0, width])
                .padding(0.3);

            const y = d3.scaleLinear()
                .domain([0, d3.max(data, d => d.value) * 1.15]) 
                .range([height, 0]);

            // --- 2. GRIGLIA (Nuova aggiunta) ---
            // Il CSS .chart-theme-universal gestirà tratteggio e nasconderà il bordo
            svg.append("g")
                .attr("class", "grid")
                .call(d3.axisLeft(y).ticks(6).tickSize(-width).tickFormat(""));

            // --- 3. BARRE ---
            svg.selectAll(".bar")
                .data(data)
                .enter().append("rect")
                .attr("class", "bar")
                .attr("x", d => x(d.originalPeriod))
                .attr("width", x.bandwidth())
                .attr("fill", LINE_COLOR)
                .attr("y", height) // Start from bottom
                .attr("height", 0)
                .transition()
                .duration(800)
                .delay((d, i) => i * 50)
                .attr("y", d => y(d.value))
                .attr("height", d => height - y(d.value));

            // --- 4. ETICHETTE VALORI ---
            svg.selectAll(".label")
                .data(data)
                .enter().append("text")
                .text(d => "€" + d.value)
                .attr("x", d => x(d.originalPeriod) + x.bandwidth() / 2)
                .attr("y", d => y(d.value) - 10)
                .attr("text-anchor", "middle")
                // Rimosso style inline, eredita font da .chart-theme-universal text
                .style("font-weight", "bold")
                .style("font-size", "15px") 
                .style("fill", "#25282A")
                .style("opacity", 0)
                .transition()
                .duration(1000)
                .delay((d, i) => i * 50 + 400)
                .style("opacity", 1);

            // --- 5. ASSE X ---
            // Aggiunta classe .axis-x per attivare la linea di base nera dal CSS
            const xAxis = d3.axisBottom(x)
                .tickFormat(d => d.includes("-S1") ? d.split("-")[0] : "");

            svg.append("g")
                .attr("class", "axis axis-x")
                .attr("transform", `translate(0,${height})`)
                .call(xAxis);
                // Rimossi font inline

            // --- 6. ASSE Y (Opzionale ma coerente) ---
            // Aggiungiamo l'asse Y per coerenza visiva (numeri a sinistra), 
            // il CSS nasconderà la linea verticale ma mostrerà i numeri.
            svg.append("g")
                .attr("class", "axis axis-y")
                .call(d3.axisLeft(y).ticks(6).tickSize(0).tickPadding(10));
            
            svg.append("text")
                .attr("class", "y-axis-label")
                .attr("x", -50)          // Allineato con l'inizio dell'asse Y
                .attr("y", 0)        // Posizionato nel margine superiore
                .style("text-anchor", "start") // Allineamento a sinistra
                .style("font-size", "15px")
                .style("font-weight", "bold")
                .style("fill", "#666") // Colore grigio scuro per non distrarre troppo
                .style("font-family", "'Fira Sans', sans-serif") // Coerente con il tema
                .text("€/KWh");

        } catch (error) {
            console.error("Error loading Gas Price Data:", error);
            container.html(`<div class="alert alert-danger">Error loading data. Check console.</div>`);
        }
    }

    if (typeof createChartHelp === "function") {
        createChartHelp("#histo-help-container", "#gas-linechart-wrapper", {
            title: "How to read the chart?",
            steps: [
                "<strong>Prices:</strong> Household gas price index.", 
                "<strong>Timeline:</strong> Aggregated by semester."
            ]
        });
    }

})();


