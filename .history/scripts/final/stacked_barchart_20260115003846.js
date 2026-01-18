// File: stacked_bar_chart_event_type.js

document.addEventListener("DOMContentLoaded", function() {
    initStackedBarChart(); 
});

function initStackedBarChart() {
    const mainContainer = d3.select("#stacked-bar-chart-container");
    const legendContainer = d3.select("#stacked-legend-container");
    const helpContainer = d3.select("#stacked-help-container");

    if (mainContainer.empty() || legendContainer.empty()) return;

    // ADDED: removal of the background (grey box)
    mainContainer
        .style("background-color", "transparent")
        .style("border", "none")
        .style("box-shadow", "none");

    // Pulizia
    mainContainer.html("");
    legendContainer.html(""); 
    helpContainer.html("");

    // --- DATI ---
    const keys = ["Battles", "Explosions/Remote violence", "Riots", "Violence against civilians", "Protests"];
    const PALETTE = ["#ff6361","#ffa600", "#58508d", "#bc5090", "#003f5c"];
    const color = d3.scaleOrdinal().domain(keys).range(PALETTE);
    let activeFilter = null;


    // Interactive Legend
    legendContainer.attr("class", "d-flex flex-wrap justify-content-start align-items-center column-gap-1 row-gap-1 mt-1");
    //legendContainer.attr("class", "d-flex flex-wrap justify-content-center align-items-center gap-4 mt-3");
    keys.forEach((key, index) => {
        const itemColor = color(key);
        const btn = legendContainer.append("button")
            .attr("class", "btn-compact d-flex align-items-center gap-2 p-0"); 

        // Pallino colorato
        btn.append("span")
            .style("width", "10px").style("height", "10px") 
            .style("background-color", itemColor)
            .style("border-radius", "50%")
            .style("display", "inline-block")
            .style("flex-shrink", "0");

        // Testo
        btn.append("span")
            .text(key)
            .style("text-transform", "uppercase") 
            .style("font-size", "12px")
            .style("font-weight", "600")
            .style("color", "#25282A"); 

        // Evento Click 
        btn.on("click", function() {
            activeFilter = (activeFilter === key) ? null : key;
            updateChartState();
        });

        // Store the key on the button for later reference
        btn.node().__key__ = key;
    });

    // Update Chart State Function
    function updateChartState() {
        d3.selectAll(".bar-rect").transition().duration(200)
            .style("opacity", d => (!activeFilter || d.key === activeFilter) ? 1 : 0.1);
        
        // Update Legend Opacity
        legendContainer.selectAll("button")
            .style("opacity", function() {
                return (!activeFilter || this.__key__ === activeFilter) ? 1 : 0.4;
            });
    }

    // -- How to read the chart --
    const barHelpContent = {
        title: "How to read the Chart",
        steps: ["X-axis: Years", "Y-axis: Percentage", "Click legend to filter."]
    };
    if (typeof createChartHelp === "function") {
        createChartHelp("#stacked-help-container", "#stacked-bar-wrapper", barHelpContent);
    }


    // Definitions of margins and dimensions
    const margin = {top: 50, right: 30, bottom: 40, left: 50};
    const width = 1000 - margin.left - margin.right;
    const height = 550 - margin.top - margin.bottom;

    // Build of SVG
    const svg = mainContainer.append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .style("width", "100%").style("height", "auto").style("display", "block")
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    /* Title: it will be handled in HTML
    svg.append("text")
        .attr("x", width / 2).attr("y", -25).attr("text-anchor", "middle")
        .style("font-family", "'Roboto Slab', serif").style("font-size", "22px").style("font-weight", "700").style("fill", "#25282A")
        .text("Normalized visualization of Top 5 Event Types");
    */

    // Data
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
        const x = d3.scaleBand().domain(wideData.map(d => d.YEAR)).range([0, width]).padding(0.1);
        const y = d3.scaleLinear().domain([0, 1]).range([height, 0]);

        svg.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(10).tickSize(-width).tickFormat("").tickSizeOuter(0))
           .call(g => g.select(".domain").remove()).selectAll("line").style("stroke", "#fff").style("stroke-width", "2px");
        svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickSizeOuter(0))
           .selectAll("text").style("font-family", "'Fira Sans', sans-serif").style("font-size", "14px");
        svg.append("g").call(d3.axisLeft(y).ticks(10, "%")).call(g => g.select(".domain").remove())
           .selectAll("text").style("font-family", "'Fira Sans', sans-serif").style("font-size", "12px");

        const groups = svg.append("g").selectAll("g").data(series).join("g").attr("fill", d => color(d.key));
        const rects = groups.selectAll("rect").data(d => d.map(v => ({ ...v, key: d.key, data: v.data })))
            .join("rect").attr("class", "bar-rect")
            .attr("x", d => x(d.data.YEAR)).attr("y", d => y(d[1])).attr("height", d => y(d[0]) - y(d[1])).attr("width", x.bandwidth())
            .style("cursor", "pointer").style("transition", "opacity 0.3s ease");

            // --- Tooltip ---
            const tooltip = d3.select("#tooltip-bar"); // in HTML code
            
            // Mouseover event
            rects.on("mouseover", function(event, d) {
                // Highlighting Logic
                if (!activeFilter) {
                    d3.selectAll(".bar-rect").style("opacity", 0.4);
                    d3.select(this).style("opacity", 1);
                }
    
                // Extraction of data for tooltip
                const eventName = d.key;                   
                const year = d.data.YEAR;                
                const value = d.data[d.key];             
                
                // Computation of total for the year
                const total = d3.sum(keys, k => d.data[k]);
                
                // Percentage calculation
                const percent = ((value / total) * 100).toFixed(1);
    
                // Display tooltip: HTML construction
                tooltip.style("visibility", "visible")
                       .html(`
                           <div style="font-family: 'Fira Sans', sans-serif; font-size: 13px; line-height: 1.5;">
                               <strong>${eventName}</strong><br>
                               <span style="color: #666;">Year:</span> ${year} <br>
                               <span style="color: #666;">Value:</span> ${value}<br>
                               <span style="color: #666;">Persentage on year:</span> ${percent}%<br>
                               
                           </div>
                       `);
            })
            .on("mousemove", function(event) {
                tooltip.style("top", (event.pageY - 10) + "px")
                       .style("left", (event.pageX + 15) + "px");
            })
            .on("mouseout", function() {
                tooltip.style("visibility", "hidden");
                if (!activeFilter) d3.selectAll(".bar-rect").style("opacity", 1);
                else updateChartState();
            });
    });
}