document.addEventListener("DOMContentLoaded", function() {
    
    // Flag per prevenire inizializzazioni multiple
    let foodChartInitialized = false;
    
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
                if (entry.target.id === "chart-section" && !foodChartInitialized) {
                    console.log("Avvio initFoodChart...");
                    foodChartInitialized = true;
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
function initFoodChart() {
    // SELEZIONE CONTAINER
    const mainContainer = d3.select("#food-chart-container");
    const legendContainer = d3.select("#food-legend-container");
    const helpContainer = d3.select("#food-help-container");

    if (mainContainer.empty()) return;

    // PULIZIA COMPLETA (importante per evitare duplicati)
    mainContainer.selectAll("*").remove();
    legendContainer.selectAll("*").remove();
    helpContainer.selectAll("*").remove();
    
    mainContainer.style("position", "relative").style("min-height", "400px");

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
            
            svg.append("path")
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


        // --- LEGENDA (UNICA - CON PROTEZIONE) ---
        console.log("Creando legenda - elementi già presenti:", legendContainer.selectAll("button").size());
        
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

        console.log("Legenda creata - totale bottoni:", legendContainer.selectAll("button").size());


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