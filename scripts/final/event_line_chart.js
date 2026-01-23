// File: event_line_chart.js

// =============================================================================
// 1. GESTIONE SCROLL (Intersection Observer)
// =============================================================================
document.addEventListener("DOMContentLoaded", function() {
    
    const options = { root: null, rootMargin: '0px', threshold: 0.5 };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Trigger per la sezione Events Line
                if (entry.target.id === "events-line-section") {
                    initEventsLineChart();
                    observer.unobserve(entry.target);
                }
            }
        });
    }, options);

    const targets = ["#events-line-section"];
    targets.forEach(selector => {
        const el = document.querySelector(selector);
        if (el) observer.observe(el);
    });
});


// =============================================================================
// 2. FUNZIONE GRAFICO LINEE (Events Trends)
// =============================================================================
function initEventsLineChart() {
    const mainContainer = d3.select("#events-line-chart-container");
    const legendContainer = d3.select("#events-line-legend-container");
    const helpContainer = d3.select("#events-line-help-container");
    const tooltip = d3.select("#events-line-tooltip");

    if (mainContainer.empty()) return;

    // PULIZIA
    mainContainer.html(""); 
    legendContainer.html("");
    helpContainer.html("");

    // Rimuove stili inline per affidarsi al CSS
    mainContainer.attr("style", "");

    // CONFIGURAZIONE DIMENSIONI
    const margin = {top: 40, right: 30, bottom: 40, left: 50}; 
    const width = 1000 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // CREAZIONE SVG (RESPONSIVE)
    const svg = mainContainer.append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // CARICAMENTO DATI
    d3.json("../../data/final/sub_event_line_chart/sub_event_line_chart.json").then(function(raw_data) {
        
        const TARGET_TYPES = [
            "Shelling/artillery/missile attack",
            "Air/drone strike",
            "Armed clash"
        ];

        const parseDate = d3.timeParse("%Y-%m-%d");

        // Data Processing
        const dataByWeek = d3.groups(raw_data, d => d.WEEK);
        const data = dataByWeek.map(([weekStr, values]) => {
            const entry = { Date: parseDate(weekStr) };
            TARGET_TYPES.forEach(type => {
                const found = values.find(v => v.SUB_EVENT_TYPE === type);
                entry[type] = found ? +found.EVENTS : 0;
            });
            return entry;
        }).sort((a, b) => a.Date - b.Date);

        // SCALE
        const x = d3.scaleTime().domain(d3.extent(data, d => d.Date)).range([0, width]);
        const maxY = d3.max(data, d => Math.max(...TARGET_TYPES.map(k => d[k])));
        const y = d3.scaleLinear().domain([0, maxY * 1.15]).range([height, 0]);
        const color = d3.scaleOrdinal().domain(TARGET_TYPES).range(["#ffa600", "#003f5c", "#ff6361"]);

        let activeFocusKey = null;

        // --- 1. GRIGLIA ---
        svg.append("g")
            .attr("class", "grid") 
            .call(d3.axisLeft(y).ticks(6).tickSize(-width).tickFormat("").tickSizeOuter(0))
            .selectAll("line")
            .filter(d => d !== 0); 

        // --- 2. LINEE ---
        const lineGenerator = (key) => d3.line().curve(d3.curveMonotoneX).x(d => x(d.Date)).y(d => y(d[key]));

        TARGET_TYPES.forEach(key => {
            const safeId = "line-sub-" + key.replace(/[^a-zA-Z0-9]/g, '-');
            
            const path = svg.append("path")
                .datum(data)
                .attr("id", safeId)
                // CLASSE .line-path IMPORTANTE per lo stile CSS universale
                .attr("class", "line-path") 
                .attr("d", lineGenerator(key))
                .attr("stroke", color(key))
                .style("fill", "none"); 

            // --- ANIMAZIONE DISEGNO ---
            const totalLength = path.node().getTotalLength();

            path
                .attr("stroke-dasharray", totalLength + " " + totalLength)
                .attr("stroke-dashoffset", totalLength)
                .transition()
                .delay(1000)
                .duration(7000)
                .ease(d3.easeCubicOut) 
                .attr("stroke-dashoffset", 0);
        });

        // --- 3. ASSI ---
        svg.append("g")
            .attr("class", "axis axis-x") 
            .attr("transform", `translate(0,${height})`)
            .call(
                d3.axisBottom(x)
                // MODIFICA QUI: Filtra i mesi per mostrare solo Gennaio (0) e Luglio (6)
                .ticks(d3.timeMonth.filter(d => d.getMonth() === 0 || d.getMonth() === 6))
                .tickFormat(d3.timeFormat("%b %y"))
                .tickSizeOuter(0)
            );

        svg.append("g")
            .attr("class", "axis axis-y") 
            .call(d3.axisLeft(y).ticks(6).tickPadding(10).tickSize(0));
        
                // --- 4. LABEL ASSE Y (NUOVA) ---
        svg.append("text")
            .attr("class", "y-axis-label")
            .attr("x", -51)        // Spostato a sinistra (margin.left è 60)
            .attr("y", 0)        // Sopra l'asse
            .style("text-anchor", "start")
            .style("font-size", "15px")
            .style("font-weight", "bold")
            .style("fill", "#666")
            .style("font-family", "'Fira Sans', sans-serif")
            .text("Number of events"); 


        // --- LEGENDA STANDARDIZZATA (CSS: .universal-legend) ---
        legendContainer.attr("class", "universal-legend");

        TARGET_TYPES.forEach(key => {
            const btn = legendContainer.append("button")
                .attr("class", "legend-item"); // Classe CSS Standard
            
            // Marker (Pallino)
            btn.append("span")
                .attr("class", "legend-marker")
                .style("background-color", color(key));
            
            // Testo
            btn.append("span")
                .attr("class", "legend-text")
                .text(key);

            // Interazione
            btn.on("click", function() {
                activeFocusKey = (activeFocusKey === key) ? null : key;
                
                // Aggiornamento grafico (trasparenza linee)
                d3.selectAll(".line-path").transition().duration(200)
                    .style("opacity", function() {
                        const id = this.id.replace("line-sub-", "");
                        const target = activeFocusKey ? activeFocusKey.replace(/[^a-zA-Z0-9]/g, '-') : null;
                        return (!activeFocusKey || id === target) ? 1 : 0.1;
                    });
                
                // Aggiornamento Legenda (uso classi CSS)
                legendContainer.selectAll(".legend-item")
                    .classed("dimmed", function() {
                        return activeFocusKey && this.__key__ !== activeFocusKey;
                    })
                    .classed("active", function() {
                        return this.__key__ === activeFocusKey;
                    });
            });
            
            btn.node().__key__ = key;
        });

        // HELP BUTTON
        const helpContent = {
            title: "How to read the chart?",
            steps: [
                "Observe how military tactics have changed over time.",
                "Hover on the line to see details.",
                "Click legend items to isolate specific event types."
            ]
        };

        if (typeof createChartHelp === "function") {
            createChartHelp("#events-line-help-container", "#events-line-wrapper", helpContent);
        }

        // --- TOOLTIP STANDARDIZZATO ---
        // Applicazione classe shared
        tooltip.attr("class", "shared-tooltip");

        const mouseG = svg.append("g").attr("class", "mouse-over-effects");
        const mouseLine = mouseG.append("path")
            .style("stroke", "#555").style("stroke-width", "1px").style("stroke-dasharray", "4,4").style("opacity", "0");

        const bisectDate = d3.bisector(d => d.Date).left;

        svg.append("rect")
            .attr("width", width).attr("height", height)
            .attr("fill", "transparent")
            .attr("pointer-events", "all")
            .on("mouseout", () => { tooltip.style("visibility", "hidden"); mouseLine.style("opacity", "0"); })
            .on("mouseover", () => { tooltip.style("visibility", "visible"); mouseLine.style("opacity", "1"); })
            .on("mousemove", function(event) {
                const mouseX = d3.pointer(event)[0];
                const x0 = x.invert(mouseX);
                const i = bisectDate(data, x0, 1);
                const d = (data[i] && (mouseX - data[i-1].Date > data[i].Date - x0)) ? data[i] : data[i-1];
                if (!d) return;

                mouseLine.attr("d", `M${x(d.Date)},0 L${x(d.Date)},${height}`);
                
                // Creazione HTML Standardizzato
                let html = `<div class="tooltip-header">${d3.timeFormat("%d %b %Y")(d.Date)}</div>`;
                
                TARGET_TYPES.forEach(k => {
                    // Logica per opacità righe tooltip se filtro attivo
                    const isFocus = !activeFocusKey || activeFocusKey === k;
                    const rowClass = isFocus ? "tooltip-row" : "tooltip-row dimmed";

                    html += `
                    <div class="${rowClass}">
                        <span class="tooltip-label">
                        <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background-color:${color(k)};"></span>${k}
                        </span>
                        <span class="tooltip-value">${d[k]}</span>
                    </div>`;
                });
                
                tooltip.html(html)
                       .style("left", (event.pageX + 15) + "px")
                       .style("top", (event.pageY - 15) + "px");
            });

    }).catch(err => { console.error("Errore caricamento dati:", err); });
}