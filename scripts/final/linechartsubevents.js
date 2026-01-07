document.addEventListener("DOMContentLoaded", function() {
    // Debug: Controllo se lo script parte
    console.log("Script caricato. Attesa IntersectionObserver...");

    const options = { root: null, threshold: 0.1 };
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && entry.target.id === "sub-event-line-section") {
                console.log("Sezione visibile! Avvio grafico...");
                initSubEventLineChart();
                obs.unobserve(entry.target);
            }
        });
    }, options);

    const target = document.querySelector("#sub-event-line-section");
    if (target) observer.observe(target);
    else if(document.querySelector("#sub-event-line-chart-container")) initSubEventLineChart();
});

function initSubEventLineChart() {
    const containerSelector = "#sub-event-line-chart-container";
    
    let mainContainer = d3.select(containerSelector);
    if (mainContainer.empty()) {
        const section = d3.select("#sub-event-line-section");
        if (!section.empty()) {
            mainContainer = section.append("div").attr("id", "sub-event-line-chart-container");
        } else {
            console.error("ERRORE: Nessun container #sub-event-line-section trovato nell'HTML.");
            return; 
        }
    }

    // 1. PULIZIA E STRUTTURA
    mainContainer.html("").style("position", "relative");

    const chartBox = mainContainer.append("div").attr("class", "chart-grey-box");
    
    const legendContainer = mainContainer.append("div")
        .attr("class", "legend-container-outer")
        .style("display", "flex")
        .style("justify-content", "center")
        .style("flex-wrap", "wrap")
        .style("gap", "10px");

    const helpOverlay = mainContainer.append("div")
        .attr("class", "chart-help-overlay")
        .on("click", function() { d3.select(this).classed("active", false); });

    helpOverlay.append("div")
        .attr("class", "chart-help-box")
        .on("click", (e) => e.stopPropagation())
        .html(`
            <h4>Conflict Intensity Over Time</h4>
            <ul>
                <li>X-axis: Time (Monthly).</li>
                <li>Y-axis: Number of events.</li>
                <li><strong>Hover on a line</strong> to highlight it.</li>
                <li><strong>Click legend</strong> to toggle lines.</li>
            </ul>
        `);

    // 2. DIMENSIONI
    const margin = {top: 50, right: 30, bottom: 80, left: 50};
    const width = 1000 - margin.left - margin.right;
    const height = 550 - margin.top - margin.bottom;

    // 3. CARICAMENTO DATI
    d3.csv("../../data/final/front_UKR.csv").then(function(raw_data) {
        
        console.log("Dati caricati:", raw_data.length, "righe");

        // --- PRE-PROCESSING ---
        const parseDate = d3.timeParse("%Y-%m-%d");
        const data = raw_data.map(d => ({
            ...d,
            date: parseDate(d.event_date),
            year: +d.year
        })).filter(d => d.year >= 2020);

        if (data.length === 0) {
            console.error("Nessun dato trovato dopo il filtro 2020");
            return;
        }

        const typeCounts = d3.rollup(data, v => v.length, d => d.sub_event_type);
        const topKeys = Array.from(typeCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(d => d[0]);

        const monthlyDataMap = d3.rollup(
            data,
            v => {
                const counts = {};
                topKeys.forEach(key => {
                    counts[key] = v.filter(d => d.sub_event_type === key).length;
                });
                return counts;
            },
            d => d3.timeMonth(d.date)
        );

        const processedData = Array.from(monthlyDataMap, ([date, values]) => {
            return { Date: date, ...values };
        }).sort((a, b) => a.Date - b.Date);

        const keys = topKeys;

        // --- CONFIGURAZIONE GRAFICO ---
        const x = d3.scaleTime().domain(d3.extent(processedData, d => d.Date)).range([0, width]);
        const maxY = d3.max(processedData, d => Math.max(...keys.map(k => d[k])));
        const y = d3.scaleLinear().domain([0, maxY * 1.1]).range([height, 0]);

        const PALETTE = ["#003f5c", "#58508d", "#bc5090", "#ff6361", "#ffa600"];
        const color = d3.scaleOrdinal().domain(keys).range(PALETTE);

        const visibilityState = {};
        keys.forEach(k => visibilityState[k] = true);

        // --- SVG ---
        const svg = chartBox.append("svg")
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
            .style("max-width", "100%")
            .style("height", "auto")
            .style("display", "block")
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Titolo
        svg.append("text")
            .attr("x", width / 2).attr("y", -20).attr("text-anchor", "middle")
            .style("font-family", "'Roboto Slab', serif")
            .style("font-size", "20px").style("font-weight", "700").style("fill", "#25282A")
            .text("Monthly Trends of Top 5 Sub-Events");

        // Assi
        svg.append("g").attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(10).tickSizeOuter(0).tickPadding(10))
            .selectAll("text").style("font-family", "'Fira Sans', sans-serif").style("font-size", "14px");

        svg.append("g")
            .call(d3.axisLeft(y).ticks(8).tickPadding(10).tickSize(0))
            .call(g => g.select(".domain").remove())
            .selectAll("text").style("font-family", "'Fira Sans', sans-serif").style("font-size", "12px");

        // Griglia
        svg.append("g").attr("class", "grid")
            .call(d3.axisLeft(y).ticks(8).tickSize(-width).tickFormat(""))
            .call(g => g.select(".domain").remove())
            .selectAll("line").style("stroke", "#b0b0b0").style("stroke-opacity", "0.5").style("stroke-dasharray", "6,10");


        // --- 1. TOOLTIP LAYER (DISEGNATO SOTTO LE LINEE) ---
        // Lo disegniamo PRIMA delle linee così le linee stanno "sopra" (Z-Index) e prendono il mouseover.
        let tooltip = d3.select("#sub-event-tooltip");
        if (tooltip.empty()) {
            tooltip = d3.select("body").append("div").attr("id", "sub-event-tooltip")
                .style("position", "absolute").style("display", "none")
                .style("background", "rgba(255, 255, 255, 0.96)")
                .style("border", "1px solid #ccc").style("padding", "10px")
                .style("border-radius", "4px").style("pointer-events", "none")
                .style("z-index", "100").style("font-family", "sans-serif").style("font-size", "12px");
        }

        const mouseG = svg.append("g").attr("class", "mouse-over-effects");
        const mouseLine = mouseG.append("path")
            .style("stroke", "#555").style("stroke-width", "1px")
            .style("stroke-dasharray", "4,4").style("opacity", "0");

        const bisectDate = d3.bisector(d => d.Date).left;

        // Questo rettangolo gestisce SOLO il tooltip generico
        svg.append("rect")
            .attr("width", width).attr("height", height)
            .attr("fill", "transparent")
            .attr("pointer-events", "all") // Cattura il mouse dove non ci sono linee
            .on("mouseout", () => { tooltip.style("display", "none"); mouseLine.style("opacity", "0"); })
            .on("mouseover", () => { tooltip.style("display", "block"); mouseLine.style("opacity", "1"); })
            .on("mousemove", function(event) {
                const mouseX = d3.pointer(event)[0];
                const x0 = x.invert(mouseX);
                const i = bisectDate(processedData, x0, 1);
                const d0 = processedData[i - 1]; const d1 = processedData[i];
                const d = (!d0 || (d1 && x0 - d0.Date > d1.Date - x0)) ? d1 : d0;
                if (!d) return;

                mouseLine.attr("d", `M${x(d.Date)},0 L${x(d.Date)},${height}`);

                let html = `<strong>${d3.timeFormat("%B %Y")(d.Date)}</strong><br>`;
                keys.forEach(k => {
                    if (visibilityState[k]) {
                        html += `<span style="color:${color(k)}">● ${k}:</span> <b>${d[k]}</b><br>`;
                    }
                });

                tooltip.html(html)
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 15) + "px");
            });

        // --- 2. DISEGNO LINEE (SOPRA IL LAYER TOOLTIP) ---
        const lineGenerator = (key) => d3.line()
            .curve(d3.curveMonotoneX)
            .x(d => x(d.Date))
            .y(d => y(d[key]));

        keys.forEach((key) => {
            // ID univoco e sicuro (rimuove spazi e caratteri speciali)
            const safeIdLine = "line-" + key.replace(/[^a-zA-Z0-9]/g, '-');
            const safeIdBtn = "btn-" + key.replace(/[^a-zA-Z0-9]/g, '-');
            
            const path = svg.append("path")
                .datum(processedData)
                .attr("id", safeIdLine)
                .attr("class", "line-trace") // Classe comune per selezionarle tutte
                .attr("fill", "none")
                .attr("stroke", color(key))
                .attr("stroke-width", 2.5)
                .attr("d", lineGenerator(key))
                .style("cursor", "pointer")
                // Fondamentale: permette alla linea di catturare il mouse sopra il rettangolo
                .style("pointer-events", "stroke"); 

            // Animazione entrata
            const totalLength = path.node().getTotalLength();
            path.attr("stroke-dasharray", totalLength + " " + totalLength)
                .attr("stroke-dashoffset", totalLength)
                .transition().duration(2000).ease(d3.easeCubicOut)
                .attr("stroke-dashoffset", 0);

            // --- LOGICA HIGHLIGHT (HOVER SULLA LINEA) ---
            path.on("mouseenter", function() {
                // 1. Rendi tutte le altre linee trasparenti
                d3.selectAll(".line-trace")
                    .transition().duration(200)
                    .style("opacity", 0.1)
                    .attr("stroke-width", 2.5);

                // 2. Evidenzia QUESTA linea
                d3.select(this)
                    .transition().duration(200)
                    .style("opacity", 1)
                    .attr("stroke-width", 5); // Molto più spessa

                // 3. Evidenzia il bottone corrispondente
                d3.selectAll(".legend-card-btn").style("opacity", 0.3); // Spegni tutti i bottoni
                d3.select("#" + safeIdBtn)
                    .style("opacity", 1)
                    .style("font-weight", "bold")
                    .style("transform", "scale(1.1)");
            })
            .on("mouseleave", function() {
                // RIPRISTINA TUTTO
                keys.forEach(k => {
                    const id = "line-" + k.replace(/[^a-zA-Z0-9]/g, '-');
                    d3.select("#" + id)
                        .transition().duration(200)
                        .style("opacity", visibilityState[k] ? 1 : 0) // Rispetta se era nascosto
                        .attr("stroke-width", 2.5);
                });

                d3.selectAll(".legend-card-btn")
                    .style("opacity", 1)
                    .style("font-weight", "normal")
                    .style("transform", "scale(1)");
            });
        });

        // --- LEGENDA ---
        keys.forEach(key => {
            const itemColor = color(key);
            const safeIdLine = "line-" + key.replace(/[^a-zA-Z0-9]/g, '-');
            const safeIdBtn = "btn-" + key.replace(/[^a-zA-Z0-9]/g, '-');

            const btn = legendContainer.append("div")
                .attr("class", "legend-card-btn")
                .attr("id", safeIdBtn) // ID per collegarlo alla linea
                .style("border-left-color", itemColor)
                .text(key)
                .on("click", function() {
                    visibilityState[key] = !visibilityState[key];
                    const isVisible = visibilityState[key];

                    // Nascondi/Mostra linea
                    d3.select("#" + safeIdLine)
                        .transition().duration(300)
                        .style("opacity", isVisible ? 1 : 0);

                    // Stile bottone attivo/inattivo
                    d3.select(this)
                        .classed("inactive", !isVisible)
                        .style("background-color", isVisible ? "#fff" : "#f5f5f5");
                })
                // Hover sul bottone evidenzia la linea (simmetrico)
                .on("mouseenter", function() {
                    if(!visibilityState[key]) return;
                    d3.selectAll(".line-trace").transition().style("opacity", 0.1);
                    d3.select("#" + safeIdLine).transition().style("opacity", 1).attr("stroke-width", 5);
                })
                .on("mouseleave", function() {
                    keys.forEach(k => {
                        const id = "line-" + k.replace(/[^a-zA-Z0-9]/g, '-');
                        d3.select("#" + id)
                            .transition()
                            .style("opacity", visibilityState[k] ? 1 : 0)
                            .attr("stroke-width", 2.5);
                    });
                });
        });

        // --- HELP BUTTON ---
        const helpGroup = svg.append("g")
            .attr("class", "help-button-trigger")
            .attr("cursor", "pointer")
            .attr("transform", `translate(0, ${height + 60})`);

        helpGroup.append("rect")
            .attr("x", -20).attr("y", -25)
            .attr("width", 260).attr("height", 50)
            .attr("fill", "transparent");

        helpGroup.append("circle").attr("r", 9).attr("fill", "black");
        helpGroup.append("text").attr("text-anchor", "middle").attr("dy", "0.35em")
            .attr("fill", "white").style("font-weight", "bold").style("font-family", "serif").text("i");
        helpGroup.append("text").attr("x", 15).attr("dy", "0.35em")
            .style("font-size", "14px").style("font-weight", "700").style("font-family", "'Fira Sans', sans-serif").style("fill", "#000")
            .text("How to read the chart?");

        helpGroup.on("mouseenter", () => helpOverlay.classed("active", true));
        helpGroup.on("mouseleave", () => helpOverlay.classed("active", false));

    }).catch(err => {
        console.error("ERRORE CRITICO CARICAMENTO:", err);
        mainContainer.html("<p style='color:red'>Errore nel caricamento del grafico. Controlla la console.</p>");
    });
}