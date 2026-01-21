// gas_linechart.js --> diventato histogram

(function() {

    // --- CONFIGURAZIONE ---
    const CSV_PATH = "../../data/final/trade-data/final_datasets/gas_price.csv"; 
    const LINE_COLOR = "#e6550d"; 

    document.addEventListener("DOMContentLoaded", function() {
        const target = document.querySelector("#gas-linechart-section");
        
        if(target) {
            const observer = new IntersectionObserver((entries, obs) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        console.log("Observer: Avvio Gas Chart (Static)...");
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

        // Dimensioni totali SVG
        const width = 1000;
        const height = 500;
        
        // MODIFICA QUI: Riserviamo 30px in basso INTERNAMENTE per far stare le etichette dell'asse
        const footerHeight = 30; 
        const chartHeight = height - footerHeight; 

        const svg = container.append("svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .append("g");

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

            // La scala Y usa 'chartHeight' invece di 'height'
            const y = d3.scaleLinear()
                .domain([0, d3.max(data, d => d.value) * 1.15]) 
                .range([chartHeight, 0]);

            // --- 1. BARRE ---
            svg.selectAll(".bar")
                .data(data)
                .enter().append("rect")
                .attr("class", "bar")
                .attr("x", d => x(d.originalPeriod))
                .attr("width", x.bandwidth())
                .attr("fill", LINE_COLOR)
                .attr("y", chartHeight) // Partono dal fondo del grafico (non dell'SVG)
                .attr("height", 0)
                .transition()
                .duration(800)
                .delay((d, i) => i * 50)
                .attr("y", d => y(d.value))
                .attr("height", d => chartHeight - y(d.value));

            // --- 2. ETICHETTE VALORI ---
            svg.selectAll(".label")
                .data(data)
                .enter().append("text")
                .text(d => "€" + d.value)
                .attr("x", d => x(d.originalPeriod) + x.bandwidth() / 2)
                .attr("y", d => y(d.value) - 10)
                .attr("text-anchor", "middle")
                .style("font-family", "Fira Sans, sans-serif")
                .style("font-size", "13px")
                .style("font-weight", "bold")
                .style("fill", "#25282A")
                .style("opacity", 0)
                .transition()
                .duration(1000)
                .delay((d, i) => i * 50 + 400)
                .style("opacity", 1);

            // --- 3. ASSE X ---
            const xAxis = d3.axisBottom(x)
                .tickFormat(d => d.includes("-S1") ? d.split("-")[0] : "");

            svg.append("g")
                .attr("class", "axis axis-x")
                // Posizioniamo l'asse a 'chartHeight' (470px) invece che 'height' (500px)
                // Così i 30px rimanenti mostrano il testo
                .attr("transform", `translate(0,${chartHeight})`)
                .call(xAxis)
                .style("font-family", "sans-serif").style("font-size", "14px");

        } catch (error) {
            console.error("Error loading Gas Price Data:", error);
            container.html(`<div class="alert alert-danger">Error loading data. Check console.</div>`);
        }
    }

    if (typeof createChartHelp === "function") {
        createChartHelp("#histo-help-container", "#gas-linechart-wrapper", {
            title: "How to read the chart",
            steps: ["<strong>Prices:</strong> Household gas price index.", "<strong>Timeline:</strong> Aggregated by semester."]
        });
    }

})();