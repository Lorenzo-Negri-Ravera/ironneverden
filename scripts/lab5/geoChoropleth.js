// File: geoChoropleth.js 

const GEOJSON_PATH = "../../data/lab5/ukraine_map/ua.json";
const ATTACKS_JSON_PATH = "../../data/lab5/GeoExplosions.json";

Promise.all([
    d3.json(GEOJSON_PATH),
    d3.json(ATTACKS_JSON_PATH)
]).then(function([geojson, raw_attacks_data]) {

    const width = 1000;
    const height = 600;
    const marginLeft = 10;
    const marginRight = 70;
    const marginBottom = 20;
    const marginTop = 40; 


    // Filter data, dropping records with null region_id, and aggregate by region_id summing the 'count'
    const attackCountsByRegion = d3.rollups(
        raw_attacks_data.filter(d => d.region_id !== null), 
        v => d3.sum(v, d => d.count),                       
        d => d.region_id                                    
    );

    // Convert the array into a Map
    const countsMap = new Map(attackCountsByRegion);

    // Add the 'count' property to each GeoJSON feature
    geojson.features.forEach(feature => {
        const regionId = feature.properties.id;
        feature.properties.count = countsMap.get(regionId) || 0;
    });

    // Get the maximum count for the color scale domain
    const maxCount = d3.max(geojson.features, d => d.properties.count);


    // Build the SVG container
    const svg = d3.select("#geo-choropleth-container")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto;");

    // Color Scale: Sequential scale using the same range as the heatmap
    // from beige to red: ["#fcd199ff", "#C8102E"]
    const colorScale = d3.scaleLinear()
        .domain([0, maxCount]) // Domain: from 0 to max count of attacks
        .range(["#fcd199ff", "#C8102E"]);

    // Projection: Ukraine map centered and scaled
    // We adjust the width to leave space for the colorbar
    const mapWidth = width - (marginRight * 2); 
    const mapHeight = height - marginTop - marginBottom;

    const projection = d3.geoMercator()
        .fitSize([mapWidth, mapHeight], geojson);

    // Path generator
    const path = d3.geoPath().projection(projection);

    // Tooltip
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background-color", "white")
        .style("border", "solid")
        .style("border-width", "1px")
        .style("border-radius", "5px")
        .style("padding", "5px");

    // Draw the Choropleth Map
    svg.append("g")
        .attr("class", "regions")
        .attr("transform", `translate(${marginLeft}, ${marginTop})`) // Center the map 
        .selectAll("path")
        .data(geojson.features)
        .join("path")
        .attr("d", path)
        .attr("fill", d => colorScale(d.properties.count)) // Color based on attack count
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.8)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("fill", "red"); // Highlight on hover
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`Region: ${d.properties.name}<br>Attacks: ${d.properties.count}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX + 10) + "px")
                   .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(event, d) {
            d3.select(this).attr("fill", colorScale(d.properties.count)); // Restore original color
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });

    // Title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", marginTop / 2)
        .attr("text-anchor", "middle") 
        .attr("class", "graph-title")
        .text("Geographic distribution of explosions on Ukraine soil during the conflict");


    
    // Define Colorbar dimensions and position
    const legendWidth = 10;
    const legendHeight = height - marginTop - marginBottom - 200; 
    
    // Position the Colorbar on the right side 
    const legendX = width - marginRight - 10;
    const legendY = (height - marginBottom - legendHeight) / 2 + marginTop; 

    const defs = svg.append("defs");

    // Create the Linear Gradient definition
    const linearGradient = defs.append("linearGradient")
        .attr("id", "choropleth-gradient")
        .attr("x1", "0%")
        .attr("x2", "0%")
        .attr("y1", "100%") // Start from the bottom (low count, light color)
        .attr("y2", "0%");  // End at the top (high count, dark color)

    // Add stop for the minimum value (light color)
    linearGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", colorScale.range()[0]); // Beige

    // Add stop for the maximum value (dark color)
    linearGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", colorScale.range()[1]); // Red

    // Draw the rectangle that uses the gradient fill
    svg.append("rect")
        .attr("x", legendX)
        .attr("y", legendY)
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#choropleth-gradient)")
        .attr("stroke", "#eee")
        .attr("stroke-width", 0.5);
    
    // Create the scale for the Colorbar
    const legendScale = d3.scaleLinear()
        .domain([0, maxCount]) 
        .range([legendY + legendHeight, legendY]); 

    // Draw the legend axis
    svg.append("g")
        .attr("class", "legend-axis")
        .attr("transform", `translate(${legendX + legendWidth + 5}, 0)`) 
        .call(d3.axisRight(legendScale)
            .ticks(5)
            .tickSize(3)
            .tickFormat(d3.format(".0f"))); // Format ticks as integers

    // Remove the axis line (domain)
    svg.select(".legend-axis .domain").remove();

    
    
     // --- HOW TO READ THE CHART? ---

    const helpButtonGroup = svg.append("g")
        .attr("class", "help-button")
        .attr("cursor", "pointer") // Indica che è interattivo
        .attr("transform", `translate(20, ${height - 60})`); 

    helpButtonGroup.append("circle")
        .attr("r", 9)
        .attr("fill", "black");

    helpButtonGroup.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em") 
        .style("fill", "white")
        .style("font-size", "12px")
        .style("font-family", "serif") 
        .style("font-weight", "bold")
        .text("i");

    helpButtonGroup.append("text")
        .attr("x", 15) 
        .attr("dy", "0.35em")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .style("fill", "black")
        .text("How to read the chart?");

    // 2. IL POPUP (Nascosto di default)
    const popupGroup = svg.append("g")
        .attr("class", "info-popup")
        .style("display", "none")
        // IMPORTANTE: pointer-events none fa sì che il mouse "ignori" il popup
        // impedendo sfarfallii se il popup si sovrappone al bottone
        .style("pointer-events", "none"); 

    // Sfondo semitrasparente (puramente visivo ora)
    popupGroup.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "rgba(255, 255, 255, 0.6)");

    // Box bianco
    const popupWidth = 400;
    const popupHeight = 200;
    
    const popupContent = popupGroup.append("g")
        .attr("transform", `translate(${(width - popupWidth) / 2}, ${(height - popupHeight) / 2})`);

    popupContent.append("rect")
        .attr("width", popupWidth)
        .attr("height", popupHeight)
        .attr("fill", "white")
        .attr("stroke", "#333")
        .attr("stroke-width", 2)
        .attr("rx", 8)
        .style("filter", "drop-shadow(0px 4px 6px rgba(0,0,0,0.3))");

    // Titolo Popup
    popupContent.append("text")
        .attr("x", popupWidth / 2)
        .attr("y", 40)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .text("How to interpret this map");

    // Istruzioni
    const instructions = [
        "1. Darker colors indicate a higher number of attacks.",
        "2. Hover over a region to see the exact count.",
        "3. Use the legend on the right for reference."
    ];

    instructions.forEach((line, i) => {
        popupContent.append("text")
            .attr("x", 30)
            .attr("y", 80 + (i * 30))
            .style("font-size", "14px")
            .style("fill", "#333")
            .text(line);
    });

    // 3. LOGICA HOVER (Mouseover / Mouseout)
    helpButtonGroup
        .on("mouseover", function() {
            popupGroup.style("display", null); // Mostra
            popupGroup.raise(); // Porta in primo piano
        })
        .on("mouseout", function() {
            popupGroup.style("display", "none"); // Nascondi
        });

}).catch(function(error) {
    console.error("Error loading data:", error);
});