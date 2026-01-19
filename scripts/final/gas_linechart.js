(function() {

    // --- CONFIGURAZIONE ---
    // Modifica il percorso se necessario (es. "../../data/...")
    const CSV_PATH = "../..//data/final/trade-data/final_datasets/gas_price.csv"; 

    // Configurazione Dimensioni
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const height = 400 - margin.top - margin.bottom;

    // Colore della linea
    const LINE_COLOR = "#e6550d"; // Un arancione acceso (tema energia/gas)

    // --- PARSER PER DATE SEMESTRALI ---
    // Converte "2021-S1" -> Date(2021, 0, 1) e "2021-S2" -> Date(2021, 6, 1)
    function parseSemester(timeStr) {
        const [year, sem] = timeStr.split("-");
        const month = sem === "S1" ? 0 : 6; // Gennaio o Luglio
        return new Date(year, month, 1);
    }

    // --- INIT FUNCTION ---
    async function initGasPriceChart() {
        const container = d3.select("#gas-price-chart-container");
        const legendContainer = d3.select("#gas-price-legend-container");
        
        // Pulisci contenitore
        container.selectAll("*").remove();
        legendContainer.selectAll("*").remove();

        // Leggi dimensioni attuali
        const containerWidth = container.node().getBoundingClientRect().width;
        const width = containerWidth - margin.left - margin.right;

        // Setup SVG
        const svg = container.append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // --- CARICAMENTO DATI ---
        try {
            const data = await d3.csv(CSV_PATH, d => {
                return {
                    date: parseSemester(d.TIME_PERIOD),
                    originalPeriod: d.TIME_PERIOD, // "2021-S1"
                    value: +d.OBS_VALUE,
                    unit: d.unit,
                    currency: d.Currency
                };
            });

            // Ordina per data (sicurezza)
            data.sort((a, b) => a.date - b.date);

            // --- SCALE ---
            const x = d3.scaleTime()
                .domain(d3.extent(data, d => d.date))
                .range([0, width]);

            const y = d3.scaleLinear()
                .domain([0, d3.max(data, d => d.value) * 1.1]) // +10% padding top
                .range([height, 0]);

            // --- ASSI ---
            // X Axis: Mostra anni e semestri in modo pulito
            const xAxis = d3.axisBottom(x)
                .ticks(d3.timeMonth.every(6)) // Un tick ogni 6 mesi
                .tickFormat(d => {
                    // Se è Gennaio mostra l'anno, se è Luglio mostra "S2" o nulla
                    return d.getMonth() === 0 ? d3.timeFormat("%Y")(d) : "";
                });

            svg.append("g")
                .attr("transform", `translate(0,${height})`)
                .call(xAxis)
                .attr("font-size", "11px")
                .attr("color", "#666");

            // Aggiungi grid lines verticali leggere
            svg.selectAll("line.vertical-grid")
                .data(x.ticks(d3.timeYear.every(1)))
                .enter()
                .append("line")
                .attr("class", "vertical-grid")
                .attr("x1", d => x(d))
                .attr("x2", d => x(d))
                .attr("y1", 0)
                .attr("y2", height)
                .attr("stroke", "#eee")
                .attr("stroke-dasharray", "3,3");

            // Y Axis
            const yAxis = d3.axisLeft(y)
                .ticks(5)
                .tickFormat(d => "€" + d); // Formato Euro

            svg.append("g")
                .call(yAxis)
                .attr("font-size", "11px")
                .attr("color", "#666")
                .call(g => g.select(".domain").remove()) // Rimuovi linea asse Y per pulizia
                .call(g => g.selectAll(".tick line") // Grid orizzontale
                    .clone()
                    .attr("x2", width)
                    .attr("stroke-opacity", 0.1));

            // Label Y Axis
            svg.append("text")
                .attr("fill", "#666")
                .attr("x", -margin.left)
                .attr("y", -10)
                .attr("text-anchor", "start")
                .style("font-size", "10px")
                .text("Price (€/KWh)");

            // --- LINE GENERATOR ---
            const line = d3.line()
                .x(d => x(d.date))
                .y(d => y(d.value))
                .curve(d3.curveMonotoneX); // Curva morbida

            // Disegna la linea
            const path = svg.append("path")
                .datum(data)
                .attr("fill", "none")
                .attr("stroke", LINE_COLOR)
                .attr("stroke-width", 2.5)
                .attr("d", line);

            // Animazione disegno linea
            const totalLength = path.node().getTotalLength();
            path.attr("stroke-dasharray", totalLength + " " + totalLength)
                .attr("stroke-dashoffset", totalLength)
                .transition()
                .duration(2000)
                .ease(d3.easeCubicOut)
                .attr("stroke-dashoffset", 0);

            // Aggiungi punti (pallini)
            svg.selectAll(".dot")
                .data(data)
                .enter()
                .append("circle")
                .attr("cx", d => x(d.date))
                .attr("cy", d => y(d.value))
                .attr("r", 4)
                .attr("fill", "white")
                .attr("stroke", LINE_COLOR)
                .attr("stroke-width", 2)
                .style("opacity", 0) // Fade in
                .transition()
                .delay((d, i) => i * 100)
                .style("opacity", 1);

            // --- INTERATTIVITÀ (TOOLTIP & MOUSE LINE) ---
            const tooltip = d3.select("#gas-price-tooltip");
            
            // Linea verticale che segue il mouse
            const mouseLine = svg.append("path")
                .attr("class", "mouse-line")
                .style("stroke", "#999")
                .style("stroke-width", "1px")
                .style("stroke-dasharray", "3,3")
                .style("opacity", "0");

            // Area trasparente per catturare eventi mouse
            const overlay = svg.append("rect")
                .attr("width", width)
                .attr("height", height)
                .style("fill", "transparent")
                .style("pointer-events", "all")
                .on("mouseover", () => {
                    tooltip.style("visibility", "visible");
                    mouseLine.style("opacity", "1");
                })
                .on("mouseout", () => {
                    tooltip.style("visibility", "hidden");
                    mouseLine.style("opacity", "0");
                })
                .on("mousemove", function(event) {
                    const mouseX = d3.pointer(event)[0];
                    // Trova il dato più vicino (Bisect)
                    const x0 = x.invert(mouseX);
                    const bisect = d3.bisector(d => d.date).left;
                    const i = bisect(data, x0, 1);
                    const d0 = data[i - 1];
                    const d1 = data[i];
                    
                    let d = d0;
                    if (d1) {
                        d = (x0 - d0.date > d1.date - x0) ? d1 : d0;
                    }

                    // Posiziona Mouse Line
                    mouseLine.attr("d", `M${x(d.date)},0 L${x(d.date)},${height}`);

                    // Aggiorna Tooltip
                    const displayDate = d.originalPeriod; // es "2021-S2"
                    
                    tooltip.html(`
                        <div style="font-weight:bold; margin-bottom:4px; color:#333;">Period: ${displayDate}</div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="width:10px; height:10px; border-radius:50%; background-color:${LINE_COLOR}; display:inline-block;"></span>
                            <span>Gas Price: <b>€${d.value}</b> / KWh</span>
                        </div>
                    `)
                    .style("top", (event.pageY - 10) + "px")
                    .style("left", (event.pageX + 15) + "px");
                });

            // --- LEGENDA ---
            legendContainer.append("div")
                .style("display", "flex")
                .style("align-items", "center")
                .style("gap", "8px")
                .style("font-size", "12px")
                .style("color", "#555")
                .html(`
                    <span style="width:12px; height:2px; background-color:${LINE_COLOR}; display:inline-block;"></span>
                    <span>Household Gas Price (Euro/KWh)</span>
                `);

        } catch (error) {
            console.error("Error loading Gas Price Data:", error);
            container.html(`<div class="alert alert-danger">Error loading data. Check console.</div>`);
        }
    }

    // --- INTERSECTION OBSERVER (Lazy Load) ---
    // Attiva il grafico solo quando l'utente scrolla verso la sezione
    document.addEventListener("DOMContentLoaded", function() {
        const target = document.querySelector("#gas-price-section");
        
        if(target) {
            const observer = new IntersectionObserver((entries, obs) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        initGasPriceChart();
                        obs.unobserve(entry.target); // Esegui una sola volta
                    }
                });
            }, { threshold: 0.1 }); // Attiva quando il 10% è visibile

            observer.observe(target);
        } else {
            // Fallback se l'elemento è già visibile o observer non supportato
            initGasPriceChart();
        }

        // Ridisegna al ridimensionamento finestra
        window.addEventListener("resize", () => {
             // Debounce semplice per non sovraccaricare
             clearTimeout(window.gasResizeTimer);
             window.gasResizeTimer = setTimeout(initGasPriceChart, 200);
        });
    });

})();