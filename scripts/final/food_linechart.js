// File: food_linechart.js

// --- 1. OBSERVER INTERNO ---
document.addEventListener("DOMContentLoaded", function() {
    const target = document.querySelector("#food_linechart_section");
    
    if (target) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    console.log("Observer: Avvio Food Chart...");
                    initFoodChart();
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        
        observer.observe(target);
    } else {
        console.warn("Attenzione: #food_linechart_section non trovato nell'HTML");
    }
});

function initFoodChart() {
    const mainContainer = d3.select("#food-chart-container");
    const legendContainer = d3.select("#food-legend-container");
    const helpContainer = d3.select("#food-help-container");

    if (mainContainer.empty()) return;

    mainContainer.html("");
    legendContainer.html("");
    helpContainer.html("");
    
    // Rimuove stili inline, lasciando fare al CSS esterno
    mainContainer.attr("style", "");

    const margin = {top: 30, right: 30, bottom: 50, left: 60}; 
    const width = 1000 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // Il container ha già la classe .chart-theme-universal nel HTML padre (#food-chart-wrapper)
    const svg = mainContainer.append("svg")
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

        const x = d3.scaleTime().domain(d3.extent(data, d => d.Date)).range([0, width]);
        const maxY = d3.max(data, d => Math.max(...keys.map(k => d[k])));
        const y = d3.scaleLinear().domain([0, maxY * 1.1]).range([height, 0]);
        
        const PALETTE = ["#003f5c", "#58508d", "#bc5090", "#ff6361", "#ffa600"];
        const color = d3.scaleOrdinal().domain(keys).range(PALETTE);

        let activeFocusKey = null;

        // 1. GRIGLIA
        svg.append("g")
            .attr("class", "grid") 
            .call(d3.axisLeft(y).ticks(6).tickSize(-width).tickFormat(""));


        // 2. LINEE
        const lineGen = (key) => d3.line().curve(d3.curveMonotoneX).x(d => x(d.Date)).y(d => y(d[key]));

        keys.forEach((key) => {
            const safeId = "line-" + key.replace(/\s+/g, '-');
            
            const path = svg.append("path")
                .datum(data)
                .attr("id", safeId)
                .attr("class", "line-path food-line") 
                .attr("fill", "none")
                .attr("stroke", color(key))
                .attr("d", lineGen(key))
                .style("cursor", "pointer");

            // --- ANIMAZIONE ---
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

        // 3. ASSI
        svg.append("g")
            .attr("class", "axis axis-x") 
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(8).tickSizeOuter(0));

        svg.append("g")
            .attr("class", "axis axis-y")
            .call(d3.axisLeft(y).ticks(6).tickSize(0).tickPadding(12));

        function updateFocus() {
            svg.selectAll(".food-line")
                .transition().duration(200)
                .style("opacity", function() {
                    const id = d3.select(this).attr("id");
                    const targetId = "line-" + (activeFocusKey ? activeFocusKey.replace(/\s+/g, '-') : "");
                    return (!activeFocusKey || id === targetId) ? 1 : 0.15;
                })
                .style("stroke-width", function() {
                    const id = d3.select(this).attr("id");
                    const targetId = "line-" + (activeFocusKey ? activeFocusKey.replace(/\s+/g, '-') : "");
                    return (!activeFocusKey || id === targetId) ? 4 : 3;
                });

            legendContainer.selectAll("button")
                .style("opacity", function() {
                    return (!activeFocusKey || this.__key__ === activeFocusKey) ? 1 : 0.4;
                });
        }

        // LEGENDA E HELP
        legendContainer.attr("class", "d-flex flex-wrap justify-content-center align-items-center column-gap-5 row-gap-1 mt-1");
        
        keys.forEach(key => {
            const btn = legendContainer.append("button")
                .attr("class", "btn-compact d-flex align-items-center gap-2 p-0 border-0 bg-transparent");
            
            btn.append("span")
                .style("width", "10px").style("height", "10px")
                .style("background-color", color(key)).style("border-radius", "50%").style("display", "inline-block");
            
            btn.append("span")
                .text(key).style("font-size", "12px").style("font-weight", "600").style("color", "#25282A").style("white-space", "nowrap");
            
            btn.on("click", function() {
                activeFocusKey = (activeFocusKey === key) ? null : key;
                updateFocus();
            });
            btn.node().__key__ = key;
        });

        const helpContent = {
            title: "Understanding Food Price Trends",
            steps: [
                "<strong>Y-Axis:</strong> Food price index values over time.",
                "<strong>Categories:</strong> Different food categories tracked monthly.",
                "<strong>Focus:</strong> Click a legend category to isolate its trend line."
            ]
        };

        if (typeof createChartHelp === "function") {
            createChartHelp("#food-help-container", "#food-chart-wrapper", helpContent);
        }

        // --- TOOLTIP STANDARDIZZATO ---
        const tooltip = d3.select("#food-chart-tooltip")
            .attr("class", "shared-tooltip");

        const mouseLine = svg.append("line")
            .attr("y1", 0).attr("y2", height)
            .style("stroke", "#ccc").style("stroke-width", "1px").style("stroke-dasharray", "4,4")
            .style("opacity", 0);

        const bisect = d3.bisector(d => d.Date).left;

        svg.append("rect")
            .attr("width", width).attr("height", height)
            .attr("fill", "transparent")
            .on("mousemove", function(event) {
                const xPos = d3.pointer(event)[0];
                const x0 = x.invert(xPos);
                const i = bisect(data, x0, 1);
                const d0 = data[i - 1];
                const d1 = data[i];
                const d = (d1 && x0 - d0.Date > d1.Date - x0) ? d1 : d0;

                if (!d) return;

                mouseLine.attr("x1", x(d.Date)).attr("x2", x(d.Date)).style("opacity", 1);
                
                // Creazione HTML Standardizzato
                let html = `<div class="tooltip-header">${d3.timeFormat("%B %Y")(d.Date)}</div>`;
                
                keys.forEach(k => {
                    const isFocus = !activeFocusKey || activeFocusKey === k;
                    const rowClass = isFocus ? "tooltip-row" : "tooltip-row dimmed";

                    html += `
                    <div class="${rowClass}">
                        <span class="tooltip-label">
                            <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background-color:${color(k)};"></span>${k}                            
                        </span>
                        <span class="tooltip-value">${d[k].toFixed(1)}</span>
                    </div>`;
                });

                tooltip.html(html)
                    .style("visibility", "visible")
                    .style("left", (event.pageX + 20) + "px")
                    .style("top", (event.pageY - 20) + "px");
            })
            .on("mouseout", () => {
                tooltip.style("visibility", "hidden");
                mouseLine.style("opacity", 0);
            });

    }).catch(err => console.error("Errore Food Chart:", err));
}