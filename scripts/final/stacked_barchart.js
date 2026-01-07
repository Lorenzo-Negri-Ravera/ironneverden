// File: stacked_bar_chart_event_type.js

document.addEventListener("DOMContentLoaded", function() {
    const options = { root: null, threshold: 0.1 };
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && entry.target.id === "stacked-bar-section") {
                initStackedBarChart();
                obs.unobserve(entry.target);
            }
        });
    }, options);

    const target = document.querySelector("#stacked-bar-section");
    if (target) observer.observe(target);
    else if(document.querySelector("#stacked-bar-chart-container")) initStackedBarChart();
});

function initStackedBarChart() {
    const containerSelector = "#stacked-bar-chart-container";
    const mainContainer = d3.select(containerSelector);

    // 1. PULIZIA
    mainContainer.html("");

    // 2. STRUTTURA
    const chartBox = mainContainer.append("div").attr("class", "chart-grey-box");
    const legendContainer = mainContainer.append("div").attr("class", "legend-container-outer");
    const helpOverlay = chartBox.append("div").attr("class", "chart-help-overlay");
    const helpContent = helpOverlay.append("div").attr("class", "chart-help-box");

    // 3. DIMENSIONI
    const margin = {top: 50, right: 30, bottom: 80, left: 60};
    const width = 1000 - margin.left - margin.right;
    const height = 550 - margin.top - margin.bottom;

    // 4. DATI - CARICAMENTO JSON
    d3.json("../../data/final/stackedbarchart/Year_Events_UKR.json").then(function(data) {
        
        console.log("1. Dati caricati:", data[0]); // Debug per vedere la struttura

        // --- PREPARAZIONE DATI ---
        // Convertiamo numeri per sicurezza
        data.forEach(d => {
            d.YEAR = +d.YEAR;
            d.count = +d.count;
        });

        // --- 1. IDENTIFICARE I TOP 5 EVENT TYPES ---
        // Dobbiamo sommare i 'count' per ogni EVENT_TYPE
        const totalCounts = d3.rollup(data, 
            v => d3.sum(v, d => d.count), // Somma la colonna count
            d => d.EVENT_TYPE
        );

        // Ordiniamo e prendiamo i primi 5
        const top5Events = Array.from(totalCounts)
            .sort((a, b) => b[1] - a[1]) // Ordine decrescente
            .slice(0, 5)
            .map(d => d[0]);

        console.log("2. Top 5 Eventi:", top5Events);

        // --- 2. FILTRARE I DATI ---
        const filteredData = data.filter(d => 
            d.YEAR >= 2017 && top5Events.includes(d.EVENT_TYPE)
        );

        const keys = top5Events; // Usiamo i top 5 come chiavi

        // --- 3. RIMODELLARE I DATI (PIVOT) ---
        // Da formato "Long" (YEAR, EVENT, count) a formato "Wide" (YEAR, Battles: 2, Protests: 15...)
        // Raggruppiamo per ANNO
        const nestedData = d3.groups(filteredData, d => d.YEAR);

        const wideData = nestedData.map(([year, values]) => {
            const obj = { YEAR: year };
            // Inizializziamo a 0 tutti i tipi di evento per questo anno
            keys.forEach(k => obj[k] = 0);
            
            // Riempiamo con i valori reali
            values.forEach(v => {
                if (keys.includes(v.EVENT_TYPE)) {
                    obj[v.EVENT_TYPE] = v.count;
                }
            });
            return obj;
        }).sort((a, b) => d3.ascending(a.YEAR, b.YEAR));

        console.log("3. Dati pronti per il grafico:", wideData);

        // --- PALETTE ---
        const PALETTE = ["#003f5c", "#58508d", "#bc5090", "#ff6361", "#ffa600"];
        const color = d3.scaleOrdinal().domain(keys).range(PALETTE);

        // --- DISEGNO SVG ---
        const svg = chartBox.append("svg")
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
            .style("max-width", "100%")
            .style("height", "auto")
            .style("display", "block")
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Titolo
        svg.append("text")
            .attr("x", width / 2).attr("y", -25).attr("text-anchor", "middle")
            .style("font-family", "'Roboto Slab', serif")
            .style("font-size", "20px").style("font-weight", "700").style("fill", "#25282A")
            .text("Normalized visualization of Top 5 Event Types");

        // Stack Generator
        const series = d3.stack()
            .keys(keys)
            .offset(d3.stackOffsetExpand) // Normalizzato al 100%
            .value((d, k) => d[k])
            (wideData);

        // Scale
        const x = d3.scaleBand().domain(wideData.map(d => d.YEAR)).range([0, width]).padding(0.1);
        const y = d3.scaleLinear().domain([0, 1]).range([height, 0]);

        // Assi e Griglia
        svg.append("g").attr("class", "grid")
            .call(d3.axisLeft(y).ticks(10).tickSize(-width).tickFormat("").tickSizeOuter(0))
            .call(g => g.select(".domain").remove())
            .selectAll("line").style("stroke", "#b0b0b0").style("stroke-opacity", "0.5").style("stroke-dasharray", "6,10");

        svg.append("g").attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).tickSizeOuter(0))
            .selectAll("text").style("font-family", "'Fira Sans', sans-serif").style("font-size", "14px");
        
        svg.append("g").call(d3.axisLeft(y).ticks(10, "%"))
           .call(g => g.select(".domain").remove())
           .selectAll("text").style("font-family", "'Fira Sans', sans-serif").style("font-size", "12px");

        // Barre
        const groups = svg.append("g").selectAll("g")
            .data(series)
            .join("g")
            .attr("fill", d => color(d.key));

        const rects = groups.selectAll("rect")
            .data(d => d.map(v => ({ ...v, key: d.key, data: v.data })))
            .join("rect")
            .attr("class", "bar-rect")
            .attr("x", d => x(d.data.YEAR))
            .attr("y", d => y(d[1]))
            .attr("height", d => y(d[0]) - y(d[1]))
            .attr("width", x.bandwidth())
            .style("transition", "opacity 0.3s ease");

        // Tooltip
        rects.append("title").text(d => {
            const val = d.data[d.key]; // Valore assoluto (preso dal count originale)
            const total = d3.sum(keys, k => d.data[k]); // Totale di quell'anno
            const percent = ((val / total) * 100).toFixed(1);
            return `${d.key}: ${val} events (${percent}%)`;
        });

        // Interazione Mouse
        let activeFilter = null;
        rects.on("mouseover", function() { if (!activeFilter) { d3.selectAll(".bar-rect").style("opacity", 0.3); d3.select(this).style("opacity", 1); } })
             .on("mouseout", function() { if (!activeFilter) d3.selectAll(".bar-rect").style("opacity", 1); else updateChartState(); });

        // Legenda
        keys.forEach(key => {
            const itemColor = color(key);
            const btn = legendContainer.append("div")
                .attr("class", "legend-card-btn")
                .style("border-left-color", itemColor)
                .text(key)
                .on("click", function() {
                    activeFilter = (activeFilter === key) ? null : key;
                    updateChartState();
                });
            btn.node().__key__ = key;
        });

        function updateChartState() {
            svg.selectAll(".bar-rect").transition().duration(200)
                .style("opacity", d => (!activeFilter || d.key === activeFilter) ? 1 : 0.1);
            legendContainer.selectAll(".legend-card-btn")
                .classed("inactive", function() { return activeFilter && this.__key__ !== activeFilter; })
                .style("background-color", function() { return (!activeFilter || this.__key__ === activeFilter) ? "#fff" : "#f5f5f5"; });
        }

        // Help Overlay
        helpContent.html(`
            <h4>Reading the Stacked Bar Chart</h4>
            <ul>
                <li>X-axis: Years (Time).</li>
                <li>Y-axis: Percentage distribution (0-100%).</li>
                <li>Visualizing: <strong>Top 5 Event Types</strong> (<br><em>${keys.join(", ")}</em>).</li>
                <li>Click legend to filter. Hover for counts.</li>
            </ul>
        `);

        const helpGroup = svg.append("g").attr("class", "help-button-trigger")
            .attr("cursor", "pointer").attr("transform", `translate(0, ${height + 60})`);
        
        helpGroup.append("rect").attr("x", -20).attr("y", -25).attr("width", 260).attr("height", 80).attr("fill", "transparent");
        helpGroup.append("circle").attr("r", 9).attr("fill", "black");
        helpGroup.append("text").attr("text-anchor", "middle").attr("dy", "0.35em").attr("fill", "white")
            .style("font-weight", "bold").style("font-family", "serif").text("i");
        helpGroup.append("text").attr("x", 15).attr("dy", "0.35em").style("font-size", "14px").style("font-weight", "700")
            .style("font-family", "'Fira Sans', sans-serif").text("How to read the chart?");

        helpGroup.on("mouseenter", () => helpOverlay.classed("active", true));
        helpGroup.on("mouseleave", () => helpOverlay.classed("active", false));

    }).catch(function(error) {
        console.error("ERRORE:", error);
    });
}