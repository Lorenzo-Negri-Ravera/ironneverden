document.addEventListener("DOMContentLoaded", function() {
    console.log("Script inizializzato...");

    const options = { root: null, threshold: 0.1 };
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && entry.target.id === "sub-event-line-section") {
                console.log("Sezione visibile! Avvio initSubEventLineChart...");
                initSubEventLineChart();
                obs.unobserve(entry.target);
            }
        });
    }, options);

    const target = document.querySelector("#sub-event-line-section");
    if (target) observer.observe(target);
    else if(document.querySelector("#sub-event-line-chart-container")) {
        initSubEventLineChart();
    } else {
        console.error("ERRORE: Non trovo il container #sub-event-line-section");
    }
});

function initSubEventLineChart() {
    const containerSelector = "#sub-event-line-chart-container";
    
    let mainContainer = d3.select(containerSelector);
    if (mainContainer.empty()) {
        const section = d3.select("#sub-event-line-section");
        if (!section.empty()) {
            mainContainer = section.append("div").attr("id", "sub-event-line-chart-container");
        } else {
            console.error("ERRORE CRITICO: Container non creato.");
            return; 
        }
    }

    // PULIZIA
    mainContainer.html("").style("position", "relative").style("min-height", "400px");

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
                <li><strong>Click legend</strong> to focus on one event type.</li>
                <li><strong>Click again</strong> to reset.</li>
            </ul>
        `);

    const margin = {top: 50, right: 30, bottom: 80, left: 50};
    const width = 1000 - margin.left - margin.right;
    const height = 550 - margin.top - margin.bottom;

    // CARICAMENTO DATI
    console.log("Caricamento CSV...");
    d3.csv("../../data/final/front_UKR.csv").then(function(raw_data) {
        
        console.log("CSV caricato. Righe:", raw_data.length);

        // --- FILTRI ---
        const TARGET_SUB_EVENTS = [
            "Shelling/artillery/missile attack",
            "Air/drone strike",
            "Armed clash"
        ];
        
        const START_DATE = new Date("2022-02-24"); 
        const parseDate = d3.timeParse("%Y-%m-%d");

        const data = raw_data.map(d => ({
            ...d,
            date: parseDate(d.event_date),
            year: +d.year
        })).filter(d => {
            return d.date >= START_DATE && TARGET_SUB_EVENTS.includes(d.sub_event_type);
        });

        if (data.length === 0) {
            console.error("Nessun dato dopo i filtri. Controlla nomi eventi o date.");
            mainContainer.html("<p style='color:red; text-align:center;'>Nessun dato trovato. Vedi console.</p>");
            return;
        }

        const availableTypes = new Set(data.map(d => d.sub_event_type));
        const keys = TARGET_SUB_EVENTS.filter(k => availableTypes.has(k));

        const monthlyDataMap = d3.rollup(
            data,
            v => {
                const counts = {};
                keys.forEach(key => {
                    counts[key] = v.filter(d => d.sub_event_type === key).length;
                });
                return counts;
            },
            d => d3.timeMonth(d.date)
        );

        const processedData = Array.from(monthlyDataMap, ([date, values]) => {
            return { Date: date, ...values };
        }).sort((a, b) => a.Date - b.Date);

        // --- GRAFICO ---
        const x = d3.scaleTime().domain(d3.extent(processedData, d => d.Date)).range([0, width]);
        const maxY = d3.max(processedData, d => Math.max(...keys.map(k => d[k] || 0)));
        const y = d3.scaleLinear().domain([0, maxY * 1.1]).range([height, 0]);

        const PALETTE = ["#d62728", "#ff7f0e", "#1f77b4"];
        const color = d3.scaleOrdinal().domain(keys).range(PALETTE);

        let activeFocusKey = null; 

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
            .style("font-family", "'Roboto Slab', serif").style("font-size", "20px").style("font-weight", "700").style("fill", "#25282A")
            .text("Monthly Trends: Shelling, Air Strikes & Clashes");

        // Assi
        svg.append("g").attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(10).tickSizeOuter(0).tickPadding(10));
        
        svg.append("g")
            .call(d3.axisLeft(y).ticks(8).tickPadding(10).tickSize(0))
            .call(g => g.select(".domain").remove());
        
        // Griglia
        svg.append("g").attr("class", "grid")
            .call(d3.axisLeft(y).ticks(8).tickSize(-width).tickFormat(""))
            .call(g => g.select(".domain").remove())
            .selectAll("line").style("stroke", "#b0b0b0").style("stroke-opacity", "0.5").style("stroke-dasharray", "6,10");

        // --- TOOLTIP ---
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
            .style("stroke", "#555").style("stroke-width", "1px").style("stroke-dasharray", "4,4").style("opacity", "0");

        const bisectDate = d3.bisector(d => d.Date).left;

        svg.append("rect")
            .attr("width", width).attr("height", height)
            .attr("fill", "transparent")
            .attr("pointer-events", "all")
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
                    let opacity = (activeFocusKey && activeFocusKey !== k) ? 0.3 : 1;
                    html += `<div style="opacity:${opacity}"><span style="color:${color(k)}">●</span> ${k}: <b>${d[k] || 0}</b></div>`;
                });
                tooltip.html(html).style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
            });

        // --- LINEE ---
        const lineGenerator = (key) => d3.line().curve(d3.curveMonotoneX).x(d => x(d.Date)).y(d => y(d[key] || 0));

        keys.forEach(key => {
            const safeIdLine = "line-" + key.replace(/[^a-zA-Z0-9]/g, '-');
            
            const path = svg.append("path")
                .datum(processedData)
                .attr("id", safeIdLine)
                .attr("class", "line-trace")
                .attr("fill", "none")
                .attr("stroke", color(key))
                .attr("stroke-width", 2.5)
                .attr("d", lineGenerator(key))
                .style("transition", "opacity 0.3s");

            path.on("mouseenter", function() {
                if (activeFocusKey) return; 
                d3.selectAll(".line-trace").style("opacity", 0.2);
                d3.select(this).style("opacity", 1).style("stroke-width", 4);
            }).on("mouseleave", function() {
                if (activeFocusKey) return;
                d3.selectAll(".line-trace").style("opacity", 1).style("stroke-width", 2.5);
            });
        });

        // --- FUNZIONE UPDATE FOCUS ---
        function updateFocusMode() {
            if (!activeFocusKey) {
                d3.selectAll(".line-trace").style("opacity", 1).style("stroke-width", 2.5);
                d3.selectAll(".legend-card-btn").style("opacity", 1).style("background", "white").style("font-weight", "normal");
            } else {
                keys.forEach(k => {
                    const safeIdLine = "line-" + k.replace(/[^a-zA-Z0-9]/g, '-');
                    const safeIdBtn = "btn-" + k.replace(/[^a-zA-Z0-9]/g, '-');
                    const isTarget = (k === activeFocusKey);

                    d3.select("#" + safeIdLine).style("opacity", isTarget ? 1 : 0.15).style("stroke-width", isTarget ? 4 : 1.5);
                    d3.select("#" + safeIdBtn)
                        .style("opacity", isTarget ? 1 : 0.4)
                        .style("background", isTarget ? "#f0f0f0" : "white")
                        .style("font-weight", isTarget ? "bold" : "normal");
                });
            }
        }

        // --- LEGENDA (COLORE A SINISTRA) ---
        keys.forEach(key => {
            const itemColor = color(key);
            const safeIdBtn = "btn-" + key.replace(/[^a-zA-Z0-9]/g, '-');

            legendContainer.append("div")
                .attr("class", "legend-card-btn")
                .attr("id", safeIdBtn)
                // Border Left = Pezzo colorato a sinistra (DEFAULT)
                .style("border-left", `5px solid ${itemColor}`)
                .style("border-right", "1px solid #ccc") 
                .style("border-top", "1px solid #ccc")
                .style("border-bottom", "1px solid #ccc")
                
                .style("padding", "5px 10px")
                .style("background", "white").style("cursor", "pointer").style("transition", "all 0.3s")
                .text(key)
                .on("click", function() {
                    if (activeFocusKey === key) activeFocusKey = null;
                    else activeFocusKey = key;
                    updateFocusMode();
                });
        });

        // --- HELP BUTTON (A SINISTRA) ---
        const helpGroup = svg.append("g")
            .attr("class", "help-button-trigger")
            .attr("cursor", "pointer")
            // Posizione a SINISTRA
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
        console.error("ERRORE D3:", err);
        mainContainer.html("<p style='color:red; text-align:center'>Errore caricamento. Vedi console.</p>");
    });
}