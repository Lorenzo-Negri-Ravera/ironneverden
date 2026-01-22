// File: divergent_bar_chart.js

(function() {
    
    // --- Configurations ---
    const CONFIG = {
        dataPath: "../../data/final/FlightsUKR/divergence_final.json", 
        margin: { top: 40, right: 60, bottom: 20, left: 150 }, 
        barHeight: 30,
        width: 1000 
    };

    // Formatter
    const formatAbs = d3.format("+,d");     
    const formatRel = d3.format("+.0%");    
    const formatPerc = d3.format(".1f");    
    const formatShare = d => d3.format("+.1f")(d) + "%"; 

    // --- Setup Container ---
    const container = d3.select("#divergence-container");
    
    if (container.empty()) return;

    // Pulizia
    container.html("");

    // Setup Tooltip
    const tooltip = d3.select("#divergence-tooltip")
        .attr("class", "shared-tooltip")
        .style("text-align", "left"); // Reset allineamento (visto che il padre è centered)

    // Creazione SVG
    const svg = container.append("svg")
        .style("width", "100%")
        .style("height", "auto")
        .style("display", "block");

    const g = svg.append("g");
    
    const xAxisGroup = g.append("g").attr("class", "x-axis");
    const yAxisGroup = g.append("g").attr("class", "y-axis");

    // --- Data Loading ---
    d3.json(CONFIG.dataPath).then(raw_data => {
        
        // Data Cleaning
        const data = raw_data
            .filter(d => d.origin_name !== "World")
            .map(d => ({
                ...d,
                Divergence: +d.Divergence,
                Perc_diff: +d.Perc_diff,
                Freq_2021: +d.Freq_2021,
                Freq_2022: +d.Freq_2022,
                Share_diff: (+d.Freq_2022) - (+d.Freq_2021)
            }));

        // Funzione di Update Principale
        function updateChart() {
            // Get Control State
            const radioNode = d3.select('input[name="metricMode"]:checked').node();
            const metric = radioNode ? radioNode.value : "absolute";
            
            // Update UI Styles
            d3.selectAll('#divergence-controls input').each(function() {
                const isChecked = d3.select(this).property("checked");
                d3.select(`label[for="${this.id}"]`).classed("active", isChecked);
            });

            // Prepare Data & Formatter
            let currentFormat;

            data.forEach(d => {
                if (metric === "absolute") {
                    d.value = d.Divergence;
                    currentFormat = formatAbs;
                } else if (metric === "relative") {
                    d.value = d.Perc_diff;
                    currentFormat = formatRel;
                } else {
                    d.value = d.Share_diff;
                    currentFormat = formatShare;
                }
            });

            // Sorting
            data.sort((a, b) => d3.ascending(a.value, b.value));

            // --- Dynamic Dimensions ---
            const height = Math.ceil((data.length + 0.1) * CONFIG.barHeight) + CONFIG.margin.top + CONFIG.margin.bottom;
            
            svg.transition().duration(750)
               .attr("viewBox", [0, 0, CONFIG.width, height]);
            
            g.attr("transform", `translate(0,${CONFIG.margin.top})`);

            // --- SCALES (FIXED OVERLAP) ---
            const extent = d3.extent(data, d => d.value);
            const rangePadding = Math.abs(extent[1] - extent[0]) * 0.15;
            
            const x = d3.scaleLinear()
                .domain([extent[0] - rangePadding, extent[1] + rangePadding])
                .rangeRound([CONFIG.margin.left, CONFIG.width - CONFIG.margin.right]);

            const y = d3.scaleBand()
                .domain(data.map(d => d.origin_name))
                .rangeRound([0, data.length * CONFIG.barHeight])
                .padding(0.1);

            // Axes
            const xAxis = d3.axisTop(x)
                .ticks(CONFIG.width / 100) 
                .tickFormat(currentFormat);

            xAxisGroup.transition().duration(750)
                .call(xAxis)
                .call(g => g.select(".domain").remove())
                .call(g => g.selectAll(".tick line")
                .attr("stroke-opacity", 0.7)
                .attr("stroke-dasharray", 4,4)
                .attr("y2", height - CONFIG.margin.top))
                .selectAll("text")
                .style("font-family", "'Fira Sans', sans-serif")
                .style("font-size", "16px");

            const yAxis = d3.axisLeft(y).tickSize(0).tickPadding(6);
            yAxisGroup.attr("transform", `translate(${CONFIG.margin.left}, 0)`)
                .transition().duration(750)
                .call(yAxis)
                .call(g => g.select(".domain").remove())
                .style("font-size", "15px")
                .style("font-weight", "600")
                .style("font-family", "'Fira Sans', sans-serif");

            // Bars
            const bars = g.selectAll(".bar").data(data, d => d.origin_name);

            bars.exit().transition().duration(500).attr("opacity", 0).remove();

            const enter = bars.enter().append("rect")
                .attr("class", "bar")
                .attr("y", d => y(d.origin_name))
                .attr("height", y.bandwidth())
                .attr("x", x(0))
                .attr("width", 0)
                .attr("opacity", 0);

            enter.merge(bars)
                .transition().duration(750)
                .attr("y", d => y(d.origin_name))
                .attr("height", y.bandwidth())
                .attr("x", d => x(Math.min(0, d.value)))
                .attr("width", d => Math.abs(x(d.value) - x(0)))
                .attr("fill", d => d.value < 0 ? "#de425b" : "#003f5c")
                .attr("opacity", 1);

            // Labels
            const labels = g.selectAll(".label-val").data(data, d => d.origin_name);

            labels.exit().remove();

            const labelsEnter = labels.enter().append("text")
                .attr("class", "label-val")
                .attr("y", d => y(d.origin_name) + y.bandwidth() / 2)
                .attr("dy", "0.35em")
                .attr("font-size", "15px")
                .attr("font-family", "'Fira Sans', sans-serif")
                .attr("opacity", 0);

            labelsEnter.merge(labels)
                .transition().duration(750)
                .text(d => currentFormat(d.value))
                .attr("x", d => x(d.value) + (d.value < 0 ? -10 : 10))
                .attr("text-anchor", d => d.value < 0 ? "end" : "start")
                .attr("y", d => y(d.origin_name) + y.bandwidth() / 2)
                .attr("opacity", 1);

            // Tooltip Events
            g.selectAll(".bar")
                .on("mouseover", function(e, d) {
                    d3.select(this).attr("fill-opacity", 0.7);
                    
                    const isNeg = d.Divergence < 0;
                    const color = isNeg ? "#b2182b" : "#2166ac";
                    const icon = isNeg ? "↘" : "↗";
                    const shareChange = d.Share_diff > 0 ? "+" + formatPerc(d.Share_diff) : formatPerc(d.Share_diff);
                    
                    // Contenuto Standardizzato
                    const htmlContent = `
                        <div class="tooltip-header" style="color:${color}; border-color:${color};">${d.origin_name}</div>
                        
                        <div class="tooltip-row">
                            <span class="tooltip-label">Flights 2021</span>
                            <span class="tooltip-value">${d.flights_2021}</span>
                        </div>
                        
                        <div class="tooltip-row">
                            <span class="tooltip-label">Flights 2022</span>
                            <span class="tooltip-value">${d.flights_2022}</span>
                        </div>

                        <div class="tooltip-row">
                            <span class="tooltip-label">Change (Abs)</span>
                            <span class="tooltip-value" style="color:${color}">${formatAbs(d.Divergence)} ${icon}</span>
                        </div>

                        <div style="border-top:1px dashed #eee; padding-top:4px; margin-top:6px; font-size:11px; color:#666;">
                            Market Share: <b>${formatPerc(d.Freq_2022)}%</b> (${shareChange}pp)
                        </div>
                    `;

                    tooltip.style("visibility", "visible").html(htmlContent);
                })
                .on("mousemove", (e) => {
                    tooltip.style("top", (e.pageY - 15) + "px").style("left", (e.pageX + 15) + "px");
                })
                .on("mouseout", function() {
                    d3.select(this).attr("fill-opacity", 1);
                    tooltip.style("visibility", "hidden");
                });
        }

        d3.selectAll('input[name="metricMode"]').on("change", updateChart);
        updateChart();

    }).catch(e => console.error("Error loading divergence data:", e));

    // Help Content
    const divergingHelpContent = {
        title: "How to read the chart?",
        steps: [
            "<strong>Positive (Blue):</strong> Increased traffic or market share.",
            "<strong>Negative (Red):</strong> Decreased traffic or market share.",
            "<strong>Metrics:</strong> Toggle between Absolute flights, Relative %, or Market Share shifts."
        ]
    };

    if (typeof createChartHelp === "function") {
        createChartHelp("#diverging-help-container", "#divergence-wrapper", divergingHelpContent);
    } else {
        console.warn("createChartHelp non trovata.");
    }

})();