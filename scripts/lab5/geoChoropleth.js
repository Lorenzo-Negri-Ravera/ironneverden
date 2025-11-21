// File: geoChoropleth.js - Choropleth Map with Region Inference

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
    const marginTop = 40; // Adjusted for better spacing

    // ----------------------------------------------------
    // 1. Data Preparation (Cleaning and Aggregation)
    // ----------------------------------------------------

    // Filter data, dropping records with null region_id, and aggregate by region_id summing the 'count'
    const attackCountsByRegion = d3.rollups(
        raw_attacks_data.filter(d => d.region_id !== null), // DISCARD nulls
        v => d3.sum(v, d => d.count),                       // Aggregation function (sum of 'count')
        d => d.region_id                                    // Grouping key (region_id)
    );

    // Convert the rollups array into a Map object for efficient lookup: { region_id: total_count }
    const countsMap = new Map(attackCountsByRegion);

    // Add the 'count' property to each GeoJSON feature
    geojson.features.forEach(feature => {
        const regionId = feature.properties.id;
        // Retrieve the count or use 0 if the region is not present in countsMap
        feature.properties.count = countsMap.get(regionId) || 0;
    });

    // Get the maximum count for the color scale domain
    const maxCount = d3.max(geojson.features, d => d.properties.count);

    // ----------------------------------------------------
    // 2. D3 Configuration (SVG, Color Scale, Projection)
    // ----------------------------------------------------

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

    // ----------------------------------------------------
    // 3. Drawing the Choropleth Map
    // ----------------------------------------------------

    svg.append("g")
        .attr("class", "regions")
        .attr("transform", `translate(${marginLeft}, ${marginTop})`) // Center the map roughly
        .selectAll("path")
        .data(geojson.features)
        .join("path")
        .attr("d", path)
        .attr("fill", d => colorScale(d.properties.count)) // Color based on attack count
        .attr("stroke", "#333")
        .attr("stroke-width", 0.5)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("fill", "red"); // Highlight on hover
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`Region: ${d.properties.name_en}<br>Attacks: ${d.properties.count}`)
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

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", marginTop / 2)
        .attr("text-anchor", "middle") 
        .attr("class", "graph-title")
        .text("Geographic distribution of explosions on Ukraine soil during the conflict");

    // ----------------------------------------------------
    // 4. Drawing the Colorbar (Legend)
    // ----------------------------------------------------
    
    // Define Colorbar dimensions and position
    const legendWidth = 10;
    const legendHeight = height - marginTop - marginBottom - 200; 
    
    // Position the legend on the right side of the SVG
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
        .attr("stroke", "#333")
        .attr("stroke-width", 0.5);

    // Create the scale for the legend axis
    const legendScale = d3.scaleLinear()
        .domain([0, maxCount]) // Domain is the data range
        .range([legendY + legendHeight, legendY]); // Range is the pixel height (reversed for top-to-bottom reading)

    // Draw the legend axis
    svg.append("g")
        .attr("class", "legend-axis")
        .attr("transform", `translate(${legendX + legendWidth + 5}, 0)`) 
        .call(d3.axisRight(legendScale)
            .ticks(5)
            .tickSize(3)
            .tickFormat(d3.format(".0f"))); // Format ticks as integers

    // Optional: Remove the axis line (domain)
    svg.select(".legend-axis .domain").remove();

}).catch(function(error) {
    console.error("Error loading data:", error);
});