document.addEventListener("DOMContentLoaded", function() {
    
    // --- 1. CONFIGURAZIONE OBSERVER (SCROLL) ---
    const options = {
        root: null,
        rootMargin: '0px',
        threshold: 0.2
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                
                // Se l'utente scrolla sul Grafico Linee
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


// --- 2. FUNZIONE GRAFICO LINEE (Cibo) ---
function initFoodChart() {
    // Evita di ridisegnare se esiste già
    if (!d3.select("#chart").select("svg").empty()) return;

    const container = d3.select(".chart-container");
    const controlsDiv = d3.select("#chart-controls-inner");
    const chartDiv = d3.select("#chart");

    // Spostiamo i controlli sotto
    container.append(() => controlsDiv.node());

    // Stile contenitore
    chartDiv
        .style("background-color", "#f8f9fa")
        .style("border", "1px solid #dee2e6")
        .style("border-radius", "8px")
        .style("padding", "15px");

    // MARGINI AGGIORNATI (Bottom 100 per il bottone Help)
    const margin = {top: 20, right: 30, bottom: 100, left: 50}, 
          width = 900 - margin.left - margin.right,
          height = 500 - margin.top - margin.bottom;

    const svg = chartDiv
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    d3.csv("../../data/final/data_food.csv").then(function(data) {

        const parseTime = d3.timeParse("%Y-%m-%d");
        const keys = data.columns.filter(k => k !== "Date");

        data.forEach(d => {
            d.Date = parseTime(d.Date);
            keys.forEach(k => d[k] = +d[k]);
        });

        // Scale
        const x = d3.scaleTime().domain(d3.extent(data, d => d.Date)).range([0, width]);
        const maxY = d3.max(data, d => Math.max(...keys.map(k => d[k])));
        const y = d3.scaleLinear().domain([0, maxY * 1.15]).range([height, 0]);
        const color = d3.scaleOrdinal().domain(keys).range(["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948"]);

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

        // Linee
        const lineGenerator = (key) => d3.line()
            .curve(d3.curveMonotoneX) 
            .x(d => x(d.Date))
            .y(d => y(d[key]));

        keys.forEach((key) => {
            const safeId = "line-" + key.replace(/\s+/g, '-');
            const path = svg.append("path")
                .datum(data)
                .attr("id", safeId)
                .attr("class", "line")
                .attr("fill", "none")
                .attr("stroke", color(key))
                .attr("stroke-width", 2.5)
                .attr("d", lineGenerator(key));

            const totalLength = path.node().getTotalLength();
            path.attr("stroke-dasharray", totalLength + " " + totalLength)
                .attr("stroke-dashoffset", totalLength)
                .transition().duration(4000).ease(d3.easeCubicOut)
                .attr("stroke-dashoffset", 0);
        });

        // --- CONTROLLI (BOTTONI GRANDI E IN RIGA) ---
        controlsDiv.html(""); 
        
        controlsDiv
            .style("display", "flex")
            .style("flex-wrap", "nowrap") // Forza una riga unica
            .style("justify-content", "center")
            .style("gap", "8px")
            .style("margin-top", "15px")
            .style("overflow-x", "auto");

        keys.forEach(key => {
            const safeId = "check-" + key.replace(/\s+/g, '-');
            const lineColor = color(key);

            const wrapper = controlsDiv.append("label")
                .style("cursor", "pointer")
                .style("display", "inline-flex")
                .style("align-items", "center")
                .style("padding", "10px 18px") // Bottoni più grandi
                .style("background", "#fff")
                .style("border", `1px solid #ccc`)
                .style("border-left", `6px solid ${lineColor}`)
                .style("border-radius", "6px") 
                .style("font-family", "sans-serif")
                .style("font-size", "15px") // Testo più grande
                .style("font-weight", "600")
                .style("color", "#555")
                .style("white-space", "nowrap") // Testo non va a capo
                .style("transition", "all 0.2s ease")
                .on("mouseover", function() {
                    d3.select(this).style("background", "#f0f0f0");
                })
                .on("mouseout", function() {
                    const chk = d3.select(this).select("input").property("checked");
                    d3.select(this).style("background", chk ? "#fff" : "#f9f9f9");
                });
            
            const input = wrapper.append("input")
                .attr("type", "checkbox")
                .attr("checked", true)
                .attr("id", safeId)
                .style("margin-right", "8px")
                .style("cursor", "pointer")
                .style("transform", "scale(1.2)")
                .on("change", function() {
                    const isChecked = this.checked;
                    d3.select("#line-" + key.replace(/\s+/g, '-'))
                      .transition().duration(200)
                      .style("opacity", isChecked ? 1 : 0);
                    
                    wrapper.style("opacity", isChecked ? "1" : "0.5");
                    wrapper.style("background", isChecked ? "#fff" : "#eee");
                });

            wrapper.append("span").text(key);
        });

        // Tooltip
        const tooltip = d3.select("#chart-tooltip");
        const bisectDate = d3.bisector(d => d.Date).left;
        const mouseG = svg.append("g").attr("class", "mouse-over-effects");
        const mouseLine = mouseG.append("path")
            .style("stroke", "#555").style("stroke-width", "1px").style("stroke-dasharray", "4,4").style("opacity", "0");

        svg.append("rect")
            .attr("width", width).attr("height", height).attr("fill", "none").attr("pointer-events", "all")
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
                    const checkbox = document.getElementById("check-" + key.replace(/\s+/g, '-'));
                    if (checkbox && checkbox.checked) {
                        tooltipHtml += `<div style="display:flex; justify-content:space-between; align-items:center; width:180px; margin-top:3px; font-size:12px;">
                            <span style="color:#555;"><span style="color:${color(key)}; font-size:14px;">●</span> ${key}</span>
                            <strong>${d[key].toFixed(1)}</strong>
                        </div>`;
                    }
                });
                tooltip.html(tooltipHtml).style("left", (event.pageX + 20) + "px").style("top", (event.pageY - 40) + "px");
            });

        // Bottone Aiuto (posizionato in basso grazie al margin.bottom aumentato)
        if (typeof setupHelpButton === "function") {
            setupHelpButton(svg, width, height, {
                x: 0, 
                y: height + 70, 
                title: "Reading the Food Price Index",
                instructions: [
                    "1. The X-axis represents time.",
                    "2. The Y-axis represents the FAO Price Index value.",
                    "3. Colored lines represent different commodity groups.",
                    "4. Use the checkboxes below to show/hide specific lines.",
                    "5. Hover over the chart to see exact monthly values."
                ]
            });
        }

    }).catch(err => { console.error("Errore dati grafico:", err); });
}

// --- 3. FUNZIONE MAPPA (STRUTTURA) ---
function initMap() {
    // 1. Seleziona il div della mappa (assicurati di avere un div con id="map" o simile nel tuo HTML)
    const mapContainer = d3.select("#map"); 

    // 2. Controllo sicurezza: se la mappa è già disegnata o il div non esiste, esci
    if (mapContainer.empty() || !mapContainer.select("svg").empty()) return;

    console.log("Inizializzazione Mappa in corso...");

    // ============================================================
    // INCOLLA QUI SOTTO IL TUO CODICE D3 PER LA MAPPA
    // Esempio: d3.json("path/to/geo.json").then(data => { ... })
    // ============================================================
    
    /* Esempio di struttura (da completare con i tuoi dati):
       
       const width = 800, height = 600;
       const svg = mapContainer.append("svg")
           .attr("viewBox", `0 0 ${width} ${height}`);
       
       const projection = d3.geoMercator().fitSize([width, height], geoData);
       const path = d3.geoPath().projection(projection);
       
       // ... resto del codice mappa ...
    */
}