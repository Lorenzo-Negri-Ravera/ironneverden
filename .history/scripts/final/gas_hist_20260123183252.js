// gas_hist.js

(function() {

    // --- CONFIGURAZIONE ---
    const CSV_PATH = "../../data/final/trade-data/final_datasets/gas_price.csv";
    const LINE_COLOR = "#f46d43"; // Colore base (sarà la parte inferiore del gradiente)

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

        // 1. MARGINI STANDARD
        const margin = {top: 40, right: 30, bottom: 40, left: 50};
        const width = 1000 - margin.left - margin.right;
        const height = 500 - margin.top - margin.bottom;

        const svg = container.append("svg")
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);


        // =============================================================================
        // --- MODIFICA GRADIENTE - INIZIO ---
        // =============================================================================
        // Definiamo il gradiente nel blocco <defs> dell'SVG.
        // Deve essere fatto PRIMA di disegnare le barre.
        const defs = svg.append("defs");

        // Creiamo un gradiente lineare verticale
        const gradient = defs.append("linearGradient")
            .attr("id", "gas-bar-gradient") // ID univoco da richiamare dopo
            .attr("x1", "0%")
            .attr("y1", "100%")  // Inizio dal basso (100%)
            .attr("x2", "0%")
            .attr("y2", "0%");   // Fine in alto (0%)

        // Stop Colore Inferiore (Il colore originale)
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", LINE_COLOR)
            .attr("stop-opacity", 1);

        // Stop Colore Superiore (Una versione leggermente più luminosa per un effetto sottile)
        // Usiamo d3.color().brighter() per calcolarlo automaticamente.
        // Modifica il valore (es. 0.8 o 0.4) per rendere l'effetto più o meno marcato.
        const topColor = d3.color(LINE_COLOR).brighter(0.6).formatHex();

        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", topColor)
            .attr("stop-opacity", 1);
        // =============================================================================
        // --- MODIFICA GRADIENTE - FINE ---
        // =============================================================================


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

            // --- 2. GRIGLIA ---
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
                // --- MODIFICA GRADIENTE: Applichiamo l'ID del gradiente invece del colore solido ---
                .attr("fill", "url(#gas-bar-gradient)")
                // -----------------------------------------------------------------------------------
                .attr("y", height)
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
                .style("font-weight", "bold")
                .style("font-size", "15px")
                .style("fill", "#25282A")
                .style("opacity", 0)
                .transition()
                .duration(1000)
                .delay((d, i) => i * 50 + 400)
                .style("opacity", 1);

            // --- 5. ASSE X ---
            const xAxis = d3.axisBottom(x)
                .tickFormat(d => d.includes("-S1") ? d.split("-")[0] : "");

            svg.append("g")
                .attr("class", "axis axis-x")
                .attr("transform", `translate(0,${height})`)
                .call(xAxis);

            // --- 6. ASSE Y ---
            svg.append("g")
                .attr("class", "axis axis-y")
                .call(d3.axisLeft(y).ticks(6).tickSize(0).tickPadding(10));

            svg.append("text")
                .attr("class", "y-axis-label")
                .attr("x", -50)
                .attr("y", 0)
                .style("text-anchor", "start")
                .style("font-size", "15px")
                .style("font-weight", "bold")
                .style("fill", "#666")
                .style("font-family", "'Fira Sans', sans-serif")
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
                "Observe the impact of the war on the price of natural gas over time",
                "Timeline aggregated by semester."
            ]
        });
    }

})();