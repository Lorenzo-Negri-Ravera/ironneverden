document.addEventListener("DOMContentLoaded", function() {
    
    //Observer configuration
    const options = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                
                // Se l'utente scrolla sul Grafico Linee (Cibo)
                if (entry.target.id === "chart-section") {
                    console.log("Avvio initFoodChart...");
                    initFoodChart();
                    observer.unobserve(entry.target);
                }

                // Se l'utente scrolla sulla Mappa
                if (entry.target.id === "map-section") {
                    console.log("Avvio initMap...");
                    if (typeof initMap === "function") {
                        initMap();
                    } else {
                        console.warn("Funzione initMap non trovata o vuota.");
                    }
                    observer.unobserve(entry.target);
                }
            }
        });
    }, options);

    // Attiviamo l'observer sugli elementi HTML
    const chartTarget = document.querySelector("#chart-section");
    if (chartTarget) observer.observe(chartTarget);

    const mapTarget = document.querySelector("#map-section");
    if (mapTarget) observer.observe(mapTarget);
});


// =============================================================================
// 2. FUNZIONE GRAFICO LINEE (Cibo - Food Price Index)
// =============================================================================
/*
function initFoodChart() {
    // Evita di ridisegnare se esiste già
    if (!d3.select("#chart").select("svg").empty()) return;

    const container = d3.select(".chart-container");
    const controlsDiv = d3.select("#chart-controls-inner");
    const chartDiv = d3.select("#chart");

    // Spostiamo i controlli sotto
    container.append(() => controlsDiv.node());

    // 1. STILE CONTENITORE
    chartDiv
        .style("background-color", "#f8f9fa")
        .style("border", "1px solid #dee2e6")
        .style("border-radius", "8px")
        .style("padding", "15px")
        .style("position", "relative");

    // 2. DIMENSIONI
    const margin = {top: 20, right: 30, bottom: 100, left: 50}, 
          width = 900 - margin.left - margin.right,
          height = 500 - margin.top - margin.bottom;

    const svg = chartDiv
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 3. OVERLAY HELP (Creato dinamicamente per uniformità)
    // Rimuoviamo eventuali vecchi overlay se presenti nel markup HTML statico per evitare duplicati
    chartDiv.selectAll(".chart-help-overlay").remove(); 
    
    const helpOverlay = chartDiv.append("div")
        .attr("class", "chart-help-overlay")
        .on("click", function() { d3.select(this).classed("active", false); });

    helpOverlay.append("div")
        .attr("class", "chart-help-box")
        .on("click", (e) => e.stopPropagation())
        .html(`
            <h4>Reading the Food Price Index</h4>
            <ul>
                <li>The X-axis represents time (up to 2025).</li>
                <li>The Y-axis represents the FAO Price Index value.</li>
                <li>Each colored line represents a commodity group.</li>
                <li><strong>Click a legend button</strong> to isolate that line (click again to reset).</li>
                <li><strong>Hover on a line</strong> to highlight it.</li>
            </ul>
        `);

    // 4. DATI
    d3.csv("../../data/final/data_food.csv").then(function(data) {

        const parseTime = d3.timeParse("%Y-%m-%d");
        const keys = data.columns.filter(k => k !== "Date");

        data.forEach(d => {
            d.Date = parseTime(d.Date);
            keys.forEach(k => d[k] = +d[k]);
        });

        // Stato visibilità per la logica di isolamento
        let visibilityState = {};
        keys.forEach(k => visibilityState[k] = true);

        // Scale
        const x = d3.scaleTime().domain(d3.extent(data, d => d.Date)).range([0, width]);
        const maxY = d3.max(data, d => Math.max(...keys.map(k => d[k])));
        const y = d3.scaleLinear().domain([0, maxY * 1.15]).range([height, 0]);
        const color = d3.scaleOrdinal().domain(keys).range(["#003f5c", "#58508d", "#bc5090", "#ff6361", "#ffa600"]);

        // Assi
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .attr("class", "axis axis-x")
            .call(d3.axisBottom(x).ticks(8).tickSize(0).tickPadding(10))
            .call(g => g.select(".domain").remove());

        svg.append("g")
            .attr("class", "axis")
            .call(d3.axisLeft(y).ticks(6).tickPadding(10).tickSize(0))
            .call(g => g.select(".domain").remove());

        // Griglia
        svg.append("g")
            .attr("class", "grid")
            .call(d3.axisLeft(y).ticks(6).tickSize(-width).tickFormat("").tickSizeOuter(0))
            .call(g => g.select(".domain").remove())
            .attr("stroke-opacity", 0.1);

        // --- LAYER TOOLTIP (SOTTO LE LINEE) ---
        // Questo rettangolo gestisce il mouseover generico per il tooltip
        let tooltip = d3.select("#chart-tooltip");
        if (tooltip.empty()) {
             tooltip = d3.select("body").append("div").attr("id", "chart-tooltip")
                .style("position", "absolute").style("display", "none")
                .style("background", "rgba(255, 255, 255, 0.96)")
                .style("border", "1px solid #ccc").style("padding", "10px")
                .style("border-radius", "4px").style("pointer-events", "none")
                .style("z-index", "100").style("font-family", "sans-serif").style("font-size", "12px");
        }

        const bisectDate = d3.bisector(d => d.Date).left;
        const mouseG = svg.append("g").attr("class", "mouse-over-effects");
        const mouseLine = mouseG.append("path")
            .style("stroke", "#555").style("stroke-width", "1px").style("stroke-dasharray", "4,4").style("opacity", "0");

        svg.append("rect")
            .attr("width", width).attr("height", height).attr("fill", "transparent").attr("pointer-events", "all")
            .on("mouseout", () => { tooltip.style("display", "none"); mouseLine.style("opacity", "0"); })
            .on("mouseover", () => { tooltip.style("display", "block"); mouseLine.style("opacity", "1"); })
            .on("mousemove", function(event) {
                const mouseX = d3.pointer(event)[0];
                const x0 = x.invert(mouseX);
                const i = bisectDate(data, x0, 1);
                const d0 = data[i - 1]; const d1 = data[i];
                const d = (!d0 || (d1 && x0 - d0.Date > d1.Date - x0)) ? d1 : d0;
                if (!d) return;

                mouseLine.attr("d", `M${x(d.Date)},0 L${x(d.Date)},${height}`);
                
                let tooltipHtml = `<div style="margin-bottom:5px; font-weight:bold; font-size:14px; border-bottom:1px solid #ddd; padding-bottom:3px; color:#333;">${d3.timeFormat("%B %Y")(d.Date)}</div>`;
                keys.forEach(key => {
                    if (visibilityState[key]) {
                        tooltipHtml += `<div style="display:flex; justify-content:space-between; align-items:center; width:180px; margin-top:3px; font-size:12px;">
                            <span style="color:#555;"><span style="color:${color(key)}; font-size:14px;">●</span> ${key}</span>
                            <strong>${d[key].toFixed(1)}</strong>
                        </div>`;
                    }
                });
                tooltip.html(tooltipHtml).style("left", (event.pageX + 20) + "px").style("top", (event.pageY - 40) + "px");
            });


        // --- DISEGNO LINEE (SOPRA IL LAYER TOOLTIP) ---
        const lineGenerator = (key) => d3.line()
            .curve(d3.curveMonotoneX) 
            .x(d => x(d.Date))
            .y(d => y(d[key]));

        keys.forEach((key) => {
            const safeId = "line-food-" + key.replace(/\s+/g, '-');
            const safeIdBtn = "btn-food-" + key.replace(/\s+/g, '-');

            const path = svg.append("path")
                .datum(data)
                .attr("id", safeId)
                .attr("class", "line-trace-food") // Classe unica
                .attr("fill", "none")
                .attr("stroke", color(key))
                .attr("stroke-width", 2.5)
                .attr("d", lineGenerator(key))
                .style("cursor", "pointer")
                .style("pointer-events", "stroke"); // Fondamentale per catturare hover sopra il rect

            // Animazione Iniziale
            const totalLength = path.node().getTotalLength();
            path.attr("stroke-dasharray", totalLength + " " + totalLength)
                .attr("stroke-dashoffset", totalLength)
                .transition().duration(4000).ease(d3.easeCubicOut)
                .attr("stroke-dashoffset", 0);

            // LOGICA HOVER SU LINEA
            path.on("mouseenter", function() {
                // 1. Diminuisci opacità delle ALTRE linee
                d3.selectAll(".line-trace-food").transition().duration(200).style("opacity", 0.1);
                
                // 2. Evidenzia QUESTA linea
                d3.select(this).transition().duration(200).style("opacity", 1).attr("stroke-width", 4.5);

                // 3. Grassetto sul bottone corrispondente (la legenda NON sparisce)
                d3.select("#" + safeIdBtn).style("font-weight", "bold").style("border-left-width", "8px");
            })
            .on("mouseleave", function() {
                // Ripristino linee
                keys.forEach(k => {
                    const id = "line-food-" + k.replace(/\s+/g, '-');
                    d3.select("#" + id).transition().duration(200)
                        .style("opacity", visibilityState[k] ? 1 : 0)
                        .attr("stroke-width", 2.5);
                });
                // Ripristino bottone
                d3.select("#" + safeIdBtn).style("font-weight", "normal").style("border-left-width", "5px");
            });
        });

        // --- CONTROLLI LEGENDA (STILE UNIFORMATO - CARDS) ---
        controlsDiv.html(""); 
        
        controlsDiv
            .attr("class", "legend-container-outer")
            .style("display", "flex")
            .style("flex-wrap", "wrap") // A capo se necessario
            .style("justify-content", "center")
            .style("gap", "10px")
            .style("margin-top", "15px");

        keys.forEach(key => {
            const safeIdLine = "line-food-" + key.replace(/\s+/g, '-');
            const safeIdBtn = "btn-food-" + key.replace(/\s+/g, '-');
            const lineColor = color(key);

            // Creiamo il DIV bottone (Stile Card)
            const btn = controlsDiv.append("div")
                .attr("id", safeIdBtn)
                .attr("class", "legend-card-btn")
                .style("cursor", "pointer")
                .style("padding", "8px 12px")
                .style("background", "#fff")
                .style("border", "1px solid #ccc")
                .style("border-left", `5px solid ${lineColor}`) // Bordo colorato
                .style("border-radius", "4px") 
                .style("font-family", "sans-serif")
                .style("font-size", "13px")
                .style("color", "#333")
                .style("user-select", "none")
                .text(key);

            // LOGICA CLICK (ISOLAMENTO)
            btn.on("click", function() {
                const visibleCount = Object.values(visibilityState).filter(v => v).length;
                const isCurrentlyVisible = visibilityState[key];

                if (visibleCount === 1 && isCurrentlyVisible) {
                    // Reset: Mostra tutto
                    keys.forEach(k => visibilityState[k] = true);
                } else {
                    // Isola: Mostra solo questo
                    keys.forEach(k => visibilityState[k] = (k === key));
                }

                // Applica modifiche
                keys.forEach(k => {
                    const idLine = "line-food-" + k.replace(/\s+/g, '-');
                    const idBtn = "btn-food-" + k.replace(/\s+/g, '-');
                    const isVisible = visibilityState[k];

                    // Aggiorna Linea
                    d3.select("#" + idLine)
                        .transition().duration(300)
                        .style("opacity", isVisible ? 1 : 0);
                    
                    // Aggiorna Bottone (stile attivo/inattivo)
                    d3.select("#" + idBtn)
                        .classed("inactive", !isVisible)
                        .style("background", isVisible ? "#fff" : "#f5f5f5")
                        .style("opacity", isVisible ? "1" : "0.6");
                });
            });
        });

        // HELP BUTTON
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

    }).catch(err => { console.error("Errore dati grafico Food:", err); });
}

// =============================================================================
// 3. FUNZIONE MAPPA (STRUTTURA)
// =============================================================================
function initMap() {
    const mapContainer = d3.select("#map"); 
    if (mapContainer.empty() || !mapContainer.select("svg").empty()) return;
    console.log("Inizializzazione Mappa in corso...");
}*/


// ... (Observer rimane uguale) ...

// =============================================================================
// 2. FUNZIONE GRAFICO LINEE (Cibo - Food Price Index)
// =============================================================================
function initFoodChart() {
    // SELEZIONE CONTAINER
    const mainContainer = d3.select("#food-chart-container");
    const legendContainer = d3.select("#food-legend-container");
    const helpContainer = d3.select("#food-help-container");

    if (mainContainer.empty()) return;

    // PULIZIA
    mainContainer.html("").style("position", "relative").style("min-height", "400px");
    legendContainer.html("");
    helpContainer.html("");

    // Rimuovi stili indesiderati dal wrapper
    d3.select("#food-chart-wrapper").style("background", "transparent").style("border", "none").style("box-shadow", "none");

    // CONFIGURAZIONE
    const margin = {top: 20, right: 30, bottom: 40, left: 50}; 
    const width = 1000 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // SVG
    const svg = mainContainer.append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .style("width", "100%").style("height", "auto").style("display", "block")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // DATI
    d3.csv("../../data/final/data_food.csv").then(function(data) {

        const parseTime = d3.timeParse("%Y-%m-%d");
        const keys = data.columns.filter(k => k !== "Date"); // Le colonne tranne Date sono le serie

        data.forEach(d => {
            d.Date = parseTime(d.Date);
            keys.forEach(k => d[k] = +d[k]);
        });

        // SCALE
        const x = d3.scaleTime().domain(d3.extent(data, d => d.Date)).range([0, width]);
        const maxY = d3.max(data, d => Math.max(...keys.map(k => d[k])));
        const y = d3.scaleLinear().domain([0, maxY * 1.15]).range([height, 0]);
        
        // Colori FAO (Simili a quelli usati)
        const PALETTE = ["#003f5c", "#58508d", "#bc5090", "#ff6361", "#ffa600"];
        const color = d3.scaleOrdinal().domain(keys).range(PALETTE);

        let activeFocusKey = null; // Per la logica di focus

        // ASSI & GRIGLIA
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(10).tickSizeOuter(0).tickPadding(10))
            .style("font-family", "'Fira Sans', sans-serif").style("font-size", "14px");

        svg.append("g")
            .call(d3.axisLeft(y).ticks(6).tickPadding(10).tickSize(0))
            .call(g => g.select(".domain").remove())
            .style("font-family", "'Fira Sans', sans-serif").style("font-size", "12px");

        // Griglia (Senza linea sullo zero)
        svg.append("g").attr("class", "grid")
            .call(d3.axisLeft(y).ticks(6).tickSize(-width).tickFormat("").tickSizeOuter(0))
            .call(g => g.select(".domain").remove())
            .selectAll("line")
            .style("stroke", "#e0e0e0")
            .style("stroke-dasharray", "4,4")
            .filter(d => d === 0).remove(); // RIMUOVE LA LINEA TRATTEGGIATA SULLO ZERO

        
        // --- LINEE ---
        const lineGenerator = (key) => d3.line().curve(d3.curveMonotoneX).x(d => x(d.Date)).y(d => y(d[key]));

        keys.forEach(key => {
            const safeId = "line-food-" + key.replace(/[^a-zA-Z0-9]/g, '-');
            
            const path = svg.append("path")
                .datum(data)
                .attr("id", safeId)
                .attr("class", "line-trace")
                .attr("fill", "none")
                .attr("stroke", color(key))
                .attr("stroke-width", 2.5)
                .attr("d", lineGenerator(key))
                .style("transition", "opacity 0.3s");
        });


        // --- FUNZIONE FOCUS ---
        function updateFocusMode() {
            // 1. Linee
            d3.selectAll(".line-trace").transition().duration(200)
                .style("opacity", function() {
                    return (!activeFocusKey || this.id === "line-food-" + activeFocusKey.replace(/[^a-zA-Z0-9]/g, '-')) ? 1 : 0.15;
                })
                .style("stroke-width", function() {
                    return (!activeFocusKey || this.id === "line-food-" + activeFocusKey.replace(/[^a-zA-Z0-9]/g, '-')) ? 2.5 : 1.5;
                });

            // 2. Legenda
            legendContainer.selectAll("button")
                .style("opacity", function() {
                    return (!activeFocusKey || this.__key__ === activeFocusKey) ? 1 : 0.4;
                });
        }


        // --- LEGENDA (STILE UNIFORMATO) ---
        legendContainer.attr("class", "d-flex flex-wrap justify-content-center align-items-center column-gap-5 row-gap-1 mt-1");

        keys.forEach(key => {
            const itemColor = color(key);
            
            const btn = legendContainer.append("button")
                .attr("class", "btn-compact d-flex align-items-center gap-2 p-0 w-auto flex-grow-0 border-0");
            
            btn.append("span")
                .style("width", "10px").style("height", "10px")
                .style("background-color", itemColor)
                .style("border-radius", "50%")
                .style("display", "inline-block")
                .style("flex-shrink", "0");
            
            btn.append("span")
                .text(key)
                .style("font-size", "12px")
                .style("font-weight", "600")
                .style("color", "#25282A")
                .style("white-space", "nowrap");

            btn.on("click", function() {
                activeFocusKey = (activeFocusKey === key) ? null : key;
                updateFocusMode();
            });
            
            btn.node().__key__ = key;
        });


        // --- HELP BUTTON ---
        const helpContent = {
            title: "Reading the Food Price Index",
            steps: [
                "<strong>Y-axis:</strong> FAO Price Index value.",
                "<strong>Lines:</strong> Price trends for different commodity groups.",
                "<strong>Interaction:</strong> Click legend to isolate a specific commodity."
            ]
        };

        if (typeof createChartHelp === "function") {
            createChartHelp("#food-help-container", "#food-chart-wrapper", helpContent);
        }


        // --- TOOLTIP (BOX UNICO) ---
        const tooltip = d3.select("#food-chart-tooltip");
        const mouseG = svg.append("g").attr("class", "mouse-over-effects");
        const mouseLine = mouseG.append("path")
            .style("stroke", "#555").style("stroke-width", "1px").style("stroke-dasharray", "4,4").style("opacity", "0");

        const bisectDate = d3.bisector(d => d.Date).left;

        svg.append("rect")
            .attr("width", width).attr("height", height)
            .attr("fill", "transparent")
            .attr("pointer-events", "all")
            .on("mouseout", () => { 
                tooltip.style("visibility", "hidden"); 
                mouseLine.style("opacity", "0"); 
            })
            .on("mouseover", () => { 
                tooltip.style("visibility", "visible"); 
                mouseLine.style("opacity", "1"); 
            })
            .on("mousemove", function(event) {
                const mouseX = d3.pointer(event)[0];
                const x0 = x.invert(mouseX);
                const i = bisectDate(data, x0, 1);
                const d0 = data[i - 1]; const d1 = data[i];
                const d = (!d0 || (d1 && x0 - d0.Date > d1.Date - x0)) ? d1 : d0;
                if (!d) return;

                mouseLine.attr("d", `M${x(d.Date)},0 L${x(d.Date)},${height}`);
                
                // Creiamo l'HTML del tooltip (Box unico con tutti i valori)
                let html = `<strong>${d3.timeFormat("%B %Y")(d.Date)}</strong><br>`;
                
                keys.forEach(k => {
                    let opacity = (activeFocusKey && activeFocusKey !== k) ? 0.3 : 1;
                    html += `<div style="opacity:${opacity}; margin-top:4px; display:flex; justify-content:space-between; width:160px;">
                        <span><span style="color:${color(k)}; font-size:12px;">●</span> ${k}:</span> 
                        <b>${d[k].toFixed(1)}</b>
                    </div>`;
                });
                
                tooltip.html(html)
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 15) + "px");
            });

    }).catch(err => { console.error("Errore dati Food:", err); });
}