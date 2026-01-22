// File: stacked_barchart.js

document.addEventListener("DOMContentLoaded", function() {
    initStackedBarChart(); 
});

function initStackedBarChart() {
    const mainContainer = d3.select("#stacked-bar-chart-container");
    const legendContainer = d3.select("#stacked-legend-container");
    const helpContainer = d3.select("#stacked-help-container");

    if (mainContainer.empty() || legendContainer.empty()) return;

    // PULIZIA
    mainContainer.html("");
    legendContainer.html(""); 
    helpContainer.html("");
    
    // Rimuovi stili manuali inline
    mainContainer.attr("style", "");

    // --- CHART DIMENSIONS (Standardizzato) ---
    const margin = {top: 40, right: 20, bottom: 40, left: 50};
    const width = 1000 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // --- SVG SETUP ---
    // Il container ha già la classe .chart-theme-universal (da HTML)
    const svg = mainContainer.append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // --- DATI ---
    const keys = ["Battles", "Explosions/Remote violence", "Riots", "Violence against civilians", "Protests"];
    const PALETTE = ["#ff6361","#ffa600", "#58508d", "#bc5090", "#003f5c"];
    const color = d3.scaleOrdinal().domain(keys).range(PALETTE);
    let activeFilter = null;

    // --- INTERACTIVE LEGEND ---
    legendContainer.attr("class", "d-flex flex-wrap justify-content-start align-items-center column-gap-3 row-gap-2 mt-2");
    
    keys.forEach((key) => {
        const itemColor = color(key);
        const btn = legendContainer.append("button")
            .attr("class", "btn-compact d-flex align-items-center gap-2 p-0 border-0 bg-transparent"); 

        btn.append("span")
            .style("width", "10px").style("height", "10px") 
            .style("background-color", itemColor)
            .style("border-radius", "50%")
            .style("display", "inline-block")
            .style("flex-shrink", "0");

        btn.append("span")
            .text(key)
            .style("text-transform", "uppercase") 
            .style("font-size", "11px")
            .style("font-weight", "600")
            .style("color", "#555"); 

        btn.on("click", function() {
            activeFilter = (activeFilter === key) ? null : key;
            updateChartState();
        });

        btn.node().__key__ = key;
    });

    function updateChartState() {
        d3.selectAll(".bar-rect").transition().duration(200)
            .style("opacity", d => (!activeFilter || d.key === activeFilter) ? 1 : 0.1);
        
        legendContainer.selectAll("button")
            .style("opacity", function() {
                return (!activeFilter || this.__key__ === activeFilter) ? 1 : 0.4;
            });
    }

    // --- DATA LOADING ---
    d3.json("../../data/final/stackedbarchart/Year_Events_UKR.json").then(function(data) {
        data.forEach(d => { d.YEAR = +d.YEAR; d.count = +d.count; if(d.EVENT_TYPE) d.EVENT_TYPE = d.EVENT_TYPE.trim(); });
        
        const filteredData = data.filter(d => d.YEAR >= 2017 && keys.includes(d.EVENT_TYPE));
        if (filteredData.length === 0) return;

        const nestedData = d3.groups(filteredData, d => d.YEAR);
        const wideData = nestedData.map(([year, values]) => {
            const obj = { YEAR: year };
            keys.forEach(k => obj[k] = 0);
            values.forEach(v => { if (keys.includes(v.EVENT_TYPE)) obj[v.EVENT_TYPE] = v.count; });
            return obj;
        }).sort((a, b) => d3.ascending(a.YEAR, b.YEAR));

        const series = d3.stack().keys(keys).offset(d3.stackOffsetExpand).value((d, k) => d[k])(wideData);
        
        // SCALES
        const x = d3.scaleBand().domain(wideData.map(d => d.YEAR)).range([0, width]).padding(0.1);
        const y = d3.scaleLinear().domain([0, 1]).range([height, 0]);

        // AXES
        // Grid Lines
        svg.append("g")
           .attr("class", "grid")
           .call(d3.axisLeft(y).ticks(10).tickSize(-width).tickFormat("").tickSizeOuter(0));

        // BARS
        const groups = svg.append("g").selectAll("g").data(series).join("g").attr("fill", d => color(d.key));
        
        const rects = groups.selectAll("rect").data(d => d.map(v => ({ ...v, key: d.key, data: v.data })))
            .join("rect").attr("class", "bar-rect")
            .attr("x", d => x(d.data.YEAR))
            .attr("y", d => y(d[1]))
            .attr("height", d => y(d[0]) - y(d[1]))
            .attr("width", x.bandwidth())
            .style("cursor", "pointer");

        // X Axis
        svg.append("g")
           .attr("class", "axis axis-x")
           .attr("transform", `translate(0,${height})`)
           .call(d3.axisBottom(x).tickSizeOuter(0));

        // Y Axis
        svg.append("g")
           .attr("class", "axis axis-y")
           .call(d3.axisLeft(y).ticks(10, "%"))
           .call(g => g.select(".domain").remove());

        // --- TOOLTIP STANDARDIZZATO ---
        const tooltip = d3.select("#tooltip-bar")
            .attr("class", "shared-tooltip");
        
        rects.on("mouseover", function(event, d) {
            if (!activeFilter) {
                d3.selectAll(".bar-rect").style("opacity", 0.4);
                d3.select(this).style("opacity", 1);
            }

            const eventName = d.key;                   
            const year = d.data.YEAR;                
            const value = d.data[d.key];             
            const total = d3.sum(keys, k => d.data[k]);
            const percent = ((value / total) * 100).toFixed(1);

            // Contenuto HTML Standard
            const htmlContent = `
                <div class="tooltip-header">${eventName} (${year})</div>
                
                <div class="tooltip-row">
                    <span class="tooltip-label">Events</span>
                    <span class="tooltip-value">${value}</span>
                </div>
                
                <div class="tooltip-row">
                    <span class="tooltip-label">Share</span>
                    <span class="tooltip-value">${percent}%</span>
                </div>
            `;

            tooltip.style("visibility", "visible").html(htmlContent);
        })
        .on("mousemove", function(event) {
            tooltip.style("top", (event.pageY - 15) + "px")
                   .style("left", (event.pageX + 15) + "px");
        })
        .on("mouseout", function() {
            tooltip.style("visibility", "hidden");
            if (!activeFilter) d3.selectAll(".bar-rect").style("opacity", 1);
            else updateChartState();
        });
    });

    // HELP CONTENT
    const barHelpContent = {
        title: "How to read the Chart",
        steps: [
            "<strong>X-axis:</strong> Years of the conflict.",
            "<strong>Y-axis:</strong> Percentage share of each event type.",
            "<strong>Interaction:</strong> Click legend items to filter specific events."
        ]
    };
    if (typeof createChartHelp === "function") {
        createChartHelp("#stacked-help-container", "#stacked-bar-wrapper", barHelpContent);
    }
}