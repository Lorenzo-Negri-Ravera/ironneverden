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
                    // console.log("Avvio initEventsLineChart...");
                    initEventsLineChart();
                    observer.unobserve(entry.target);
                }
            }
        });
    }, options);

    // Osserva i nuovi ID
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
    // SELEZIONE CONTAINER (Usa i nuovi ID che hai definito nell'HTML)
    const mainContainer = d3.select("#events-line-chart-container");
    const legendContainer = d3.select("#events-line-legend-container");
    const helpContainer = d3.select("#events-line-help-container");
    const tooltip = d3.select("#events-line-tooltip");

    if (mainContainer.empty()) return;

    // PULIZIA
    mainContainer.html(""); 
    legendContainer.html("");
    helpContainer.html("");

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
        const color = d3.scaleOrdinal().domain(TARGET_TYPES).range(["#d62728", "#ff7f0e", "#1f77b4"]);

        let activeFocusKey = null;

        // --- 1. DISEGNA PRIMA LA GRIGLIA (Così sta sotto a tutto) ---
        svg.append("g")
            .attr("class", "grid") 
            .call(d3.axisLeft(y).ticks(6).tickSize(-width).tickFormat("").tickSizeOuter(0))
            .call(g => g.select(".domain").remove())
            .selectAll("line")
            // Rimuove la linea se il valore è 0 (opzionale, per pulizia extra sullo 0)
            .filter(d => d !== 0); 

        // --- 2. POI LE LINEE (Contenuto) ---
        /*
        const lineGenerator = (key) => d3.line().curve(d3.curveMonotoneX).x(d => x(d.Date)).y(d => y(d[key]));

        TARGET_TYPES.forEach(key => {
            const safeId = "line-sub-" + key.replace(/[^a-zA-Z0-9]/g, '-');
            svg.append("path")
                .datum(data)
                .attr("id", safeId)
                // CLASSE FONDAMENTALE PER IL CSS UNIVERSALE
                .attr("class", "line-path") 
                .attr("d", lineGenerator(key))
                .attr("stroke", color(key))
                .style("fill", "none"); 
        });*/

        //NEW
        // --- 2. POI LE LINEE (Contenuto) ---
        const lineGenerator = (key) => d3.line().curve(d3.curveMonotoneX).x(d => x(d.Date)).y(d => y(d[key]));

        TARGET_TYPES.forEach(key => {
            const safeId = "line-sub-" + key.replace(/[^a-zA-Z0-9]/g, '-');
            
            // Assegniamo il path a una costante per poter calcolare la lunghezza
            const path = svg.append("path")
                .datum(data)
                .attr("id", safeId)
                // CLASSE FONDAMENTALE PER IL CSS UNIVERSALE
                .attr("class", "line-path") 
                .attr("d", lineGenerator(key))
                .attr("stroke", color(key))
                .style("fill", "none"); 

            // --- ANIMAZIONE DISEGNO ---
            const totalLength = path.node().getTotalLength();

            path
                // Imposta il tratteggio lungo quanto tutta la linea
                .attr("stroke-dasharray", totalLength + " " + totalLength)
                // Nasconde la linea spostando il tratteggio
                .attr("stroke-dashoffset", totalLength)
                // Avvia la transizione
                .transition()
                .delay(1000)     // Ritardo di 0.5s per aspettare che l'occhio si posi sul grafico
                .duration(7000) // Durata 2.5s per un effetto fluido
                .ease(d3.easeCubicOut) // Rallenta alla fine
                .attr("stroke-dashoffset", 0); // Rivela la linea
        });

        // --- 3. INFINE GLI ASSI (Cosi tick e linea nera stanno sopra la griglia) ---
        
        // Asse X (Aggiunta classe 'axis-x' per far apparire i tick via CSS)
        svg.append("g")
            .attr("class", "axis axis-x") 
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(10).tickFormat(d3.timeFormat("%b %y")).tickSizeOuter(0).tickPadding(10));

        // Asse Y (Aggiunta classe 'axis-y')
        svg.append("g")
            .attr("class", "axis axis-y") 
            .call(d3.axisLeft(y).ticks(6).tickPadding(10).tickSize(0))
            .call(g => g.select(".domain").remove());


        // LEGENDA
        legendContainer.attr("class", "d-flex flex-wrap justify-content-center align-items-center column-gap-3 row-gap-2 mt-2");

        TARGET_TYPES.forEach(key => {
            const btn = legendContainer.append("button")
                .attr("class", "btn-compact d-flex align-items-center gap-2 p-0 border-0 bg-transparent");
            
            btn.append("span")
                .style("width", "10px").style("height", "10px")
                .style("background-color", color(key)).style("border-radius", "50%").style("display", "inline-block");
            
            btn.append("span")
                .text(key).style("font-size", "12px").style("font-weight", "600").style("color", "#25282A").style("white-space", "nowrap");

            // Logica interattiva (Filter / Highlight)
            btn.on("click", function() {
                activeFocusKey = (activeFocusKey === key) ? null : key;
                
                // Opacità linee
                d3.selectAll(".line-path").transition().duration(200)
                    .style("opacity", function() {
                        const id = this.id.replace("line-sub-", "");
                        const target = activeFocusKey ? activeFocusKey.replace(/[^a-zA-Z0-9]/g, '-') : null;
                        return (!activeFocusKey || id === target) ? 1 : 0.1;
                    });
                
                // Opacità bottoni legenda
                legendContainer.selectAll("button")
                    .style("opacity", function() {
                        return (!activeFocusKey || this.__key__ === activeFocusKey) ? 1 : 0.4;
                    });
            });
            btn.node().__key__ = key;
        });

        // HELP BUTTON
        const helpContent = {
            title: "Understanding Conflict Trends",
            steps: [
                "<strong>Y-Axis:</strong> Number of weekly recorded events.",
                "<strong>Categories:</strong> Shelling, strikes, and direct armed clashes.",
                "<strong>Focus:</strong> Click a legend category to isolate its trend line."
            ]
        };

        if (typeof createChartHelp === "function") {
            createChartHelp("#events-line-help-container", "#events-line-wrapper", helpContent);
        }

        // TOOLTIP & MOUSE EFFECTS
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
                
                let html = `<div style="font-weight:bold; border-bottom:1px solid #eee; margin-bottom:4px; font-family: 'Fira Sans', sans-serif;">${d3.timeFormat("%d %b %Y")(d.Date)}</div>`;
                
                TARGET_TYPES.forEach(k => {
                    let opacity = (activeFocusKey && activeFocusKey !== k) ? 0.3 : 1;
                    html += `<div style="opacity:${opacity}; margin-top:4px; display:flex; justify-content:space-between; gap:15px; font-family: 'Fira Sans', sans-serif; font-size:12px;">
                        <span><span style="color:${color(k)};">●</span> ${k}:</span> <b>${d[k]}</b>
                    </div>`;
                });
                tooltip.html(html).style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
            });

    }).catch(err => { console.error("Errore caricamento dati:", err); });
}