document.addEventListener("DOMContentLoaded", function() {
    
    let foodChartInitialized = false;
    let mapInitialized = false; // Aggiunto flag anche per la mappa
    
    const options = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                
                // --- Inizializzazione Grafico Cibo ---
                if (entry.target.id === "chart-section" && !foodChartInitialized) {
                    foodChartInitialized = true; // Flag immediato
                    console.log("Inizializzazione Food Chart...");
                    initFoodChart();
                    observer.unobserve(entry.target);
                }

                // --- Inizializzazione Mappa ---
                if (entry.target.id === "map-section" && !mapInitialized) {
                    mapInitialized = true;
                    console.log("Inizializzazione Mappa...");
                    if (typeof initMap === "function") {
                        initMap();
                    }
                    observer.unobserve(entry.target);
                }
            }
        });
    }, options);

    const chartTarget = document.querySelector("#chart-section");
    if (chartTarget) observer.observe(chartTarget);

    const mapTarget = document.querySelector("#map-section");
    if (mapTarget) observer.observe(mapTarget);
});

// =============================================================================
// FUNZIONE GRAFICO LINEE (Food Price Index)
// =============================================================================
function initFoodChart() {
    const mainContainer = d3.select("#food-chart-container");
    const legendContainer = d3.select("#food-legend-container");
    const helpContainer = d3.select("#food-help-container");

    if (mainContainer.empty()) return;

    // Pulizia iniziale dei contenitori
    mainContainer.selectAll("*").remove();
    legendContainer.selectAll("*").remove();
    helpContainer.selectAll("*").remove();
    
    mainContainer.style("position", "relative").style("min-height", "400px");

    const margin = {top: 20, right: 30, bottom: 40, left: 50}; 
    const width = 1000 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = mainContainer.append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .style("width", "100%").style("height", "auto")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    d3.csv("../../data/final/data_food.csv").then(function(data) {
        
        // --- PROTEZIONE DOPPIA LEGENDA ---
        // Se per qualche motivo la funzione corre due volte, svuotiamo di nuovo qui
        legendContainer.html(""); 

        const parseTime = d3.timeParse("%Y-%m-%d");
        const keys = data.columns.filter(k => k !== "Date");

        data.forEach(d => {
            d.Date = parseTime(d.Date);
            keys.forEach(k => d[k] = +d[k]);
        });

        // SCALE
        const x = d3.scaleTime().domain(d3.extent(data, d => d.Date)).range([0, width]);
        const maxY = d3.max(data, d => Math.max(...keys.map(k => d[k])));
        const y = d3.scaleLinear().domain([0, maxY * 1.15]).range([height, 0]);
        
        const PALETTE = ["#003f5c", "#58508d", "#bc5090", "#ff6361", "#ffa600"];
        const color = d3.scaleOrdinal().domain(keys).range(PALETTE);

        let activeFocusKey = null;

        // ASSI
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(10).tickSizeOuter(0))
            .style("font-family", "sans-serif").style("font-size", "14px");

        svg.append("g")
            .call(d3.axisLeft(y).ticks(6).tickSize(0).tickPadding(10))
            .call(g => g.select(".domain").remove())
            .style("font-family", "sans-serif").style("font-size", "12px");

        // GRIGLIA
        svg.append("g")
            .attr("class", "grid")
            .call(d3.axisLeft(y).ticks(6).tickSize(-width).tickFormat(""))
            .call(g => g.select(".domain").remove())
            .selectAll("line")
            .style("stroke", "#e0e0e0")
            .style("stroke-dasharray", "4,4");

        // LINEE
        const lineGen = (key) => d3.line().curve(d3.curveMonotoneX).x(d => x(d.Date)).y(d => y(d[key]));

        keys.forEach(key => {
            const safeId = "line-" + key.replace(/\s+/g, '-');
            svg.append("path")
                .datum(data)
                .attr("id", safeId)
                .attr("class", "food-line")
                .attr("fill", "none")
                .attr("stroke", color(key))
                .attr("stroke-width", 2.5)
                .attr("d", lineGen(key))
                .style("transition", "opacity 0.3s, stroke-width 0.3s");
        });

        // --- LOGICA FOCUS ---
        function updateFocus() {
            svg.selectAll(".food-line")
                .style("opacity", function() {
                    const id = d3.select(this).attr("id");
                    const targetId = "line-" + (activeFocusKey ? activeFocusKey.replace(/\s+/g, '-') : "");
                    return (!activeFocusKey || id === targetId) ? 1 : 0.1;
                })
                .style("stroke-width", function() {
                    const id = d3.select(this).attr("id");
                    const targetId = "line-" + (activeFocusKey ? activeFocusKey.replace(/\s+/g, '-') : "");
                    return (!activeFocusKey || id === targetId) ? 3 : 1.5;
                });

            legendContainer.selectAll(".legend-btn")
                .style("opacity", function() {
                    return (!activeFocusKey || this.__key__ === activeFocusKey) ? 1 : 0.3;
                });
        }

        // --- CREAZIONE LEGENDA ---
        legendContainer.attr("class", "d-flex flex-wrap justify-content-center gap-4 mt-3");

        keys.forEach(key => {
            const btn = legendContainer.append("div")
                .attr("class", "legend-btn d-flex align-items-center gap-2")
                .style("cursor", "pointer")
                .style("transition", "opacity 0.2s");

            btn.append("span")
                .style("width", "12px").style("height", "12px")
                .style("background-color", color(key))
                .style("border-radius", "50%");

            btn.append("span")
                .text(key)
                .style("font-size", "13px").style("font-weight", "600");

            btn.node().__key__ = key;

            btn.on("click", function() {
                activeFocusKey = (activeFocusKey === key) ? null : key;
                updateFocus();
            });
        });

        // --- TOOLTIP ---
        const tooltip = d3.select("#food-chart-tooltip");
        const mouseLine = svg.append("line")
            .attr("y1", 0).attr("y2", height)
            .style("stroke", "#999").style("stroke-width", "1px").style("stroke-dasharray", "3,3")
            .style("opacity", 0);

        const bisect = d3.bisector(d => d.Date).left;

        svg.append("rect")
            .attr("width", width).attr("height", height)
            .attr("fill", "transparent")
            .on("mousemove", function(event) {
                const x0 = x.invert(d3.pointer(event)[0]);
                const i = bisect(data, x0, 1);
                const d = x0 - data[i-1].Date > data[i].Date - x0 ? data[i] : data[i-1];

                mouseLine.attr("x1", x(d.Date)).attr("x2", x(d.Date)).style("opacity", 1);
                
                let html = `<div style="font-weight:bold; border-bottom:1px solid #ccc; margin-bottom:5px;">${d3.timeFormat("%B %Y")(d.Date)}</div>`;
                keys.forEach(k => {
                    const isDimmed = activeFocusKey && activeFocusKey !== k;
                    html += `<div style="display:flex; justify-content:space-between; gap:20px; font-size:12px; opacity:${isDimmed ? 0.3 : 1}">
                                <span><i style="color:${color(k)}">●</i> ${k}</span>
                                <b>${d[k].toFixed(1)}</b>
                             </div>`;
                });

                tooltip.html(html)
                    .style("visibility", "visible")
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 15) + "px");
            })
            .on("mouseout", () => {
                tooltip.style("visibility", "hidden");
                mouseLine.style("opacity", 0);
            });

    }).catch(err => console.error("Errore caricamento CSV Food:", err));
}