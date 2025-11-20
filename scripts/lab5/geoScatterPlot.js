// File: geoScatterPlot.js
const GEOJSON_PATH = "../../data/lab5/ukraine_map/ua.json";
const ATTACKS_JSON_PATH = "../../data/lab5/GeoAttacks.json";

Promise.all([
    d3.json(GEOJSON_PATH),
    d3.json(ATTACKS_JSON_PATH)
]).then(function([geojson, raw_attacks_data]) {

    // Define SVG dimensions
    const width = 1000;
    const height = 600;
    const marginLeft = 50;
    const marginRight = 50;

    // Select the SVG container element and set dimensions
    const svg = d3.select("#geo-scatter-plot-container")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto");

    // Aggregate attack counts by location (longitude, latitude)
    const aggregated_map = new Map();
    raw_attacks_data.forEach(d => {
        // Use a unique key based on centroid coordinates
        const key = `${d.CENTROID_LONGITUDE},${d.CENTROID_LATITUDE}`;
        const count = +d.count || 0; 

        if (aggregated_map.has(key)) {
            aggregated_map.get(key).attack_count += count;
        } else {
            aggregated_map.set(key, {
                longitude: +d.CENTROID_LONGITUDE,
                latitude: +d.CENTROID_LATITUDE,
                attack_count: count
            });
        }
    });

    const attacks_data = Array.from(aggregated_map.values());
    
    // --- 3. PROJECTION CONFIGURATION (Fit to Bounds) ---

    // Define the initial projection (e.g., Mercator)
    const projection = d3.geoMercator();
        
    // Create an initial path generator (needed for bounds calculation)
    const path = d3.geoPath()
        .projection(projection);

    // Calculate the geographical center
    const center = d3.geoCentroid(geojson);

    // Automatically fit the projection to the SVG extent
    projection
        .center(center) 
        .fitExtent(
            // Extent (pixel boundaries) for the map, adding a 10px padding
            [[marginLeft, 10], [width - marginRight, height - 10]], 
            geojson // The GeoJSON object to fit
        );
        
    // Recreate the path generator with the adapted projection
    const updatedPath = d3.geoPath()
        .projection(projection);

    // --- 4. DRAW THE MAP (Boundaries) ---
    svg.selectAll(".region-boundary")
        .data(geojson.features)
        .join("path")
        .attr("class", "region-boundary")
        .attr("d", updatedPath) 
        .attr("fill", "#e0e0e0") 
        .attr("stroke", "#333") 
        .attr("stroke-width", 0.5);
    
    // --- 5. CONFIGURATION FOR SCATTER PLOT POINTS ---

    // Find the maximum attack count for scaling
    const maxAttackCount = d3.max(attacks_data, d => d.attack_count);
    
    // Use a square root scale (d3.scaleSqrt) for the radius
    const radiusScale = d3.scaleSqrt()
        .domain([0, maxAttackCount])
        .range([3, 25]); // Min radius 3px, Max radius 25px
    
    // --- 6. DRAW THE SCATTER PLOT (Circles) ---
    svg.selectAll(".attack-dot")
        .data(attacks_data) 
        .enter()
        .append("circle")
        .attr("class", "attack-dot")
        // Project Lat/Long coordinates to screen coordinates
        .attr("cx", d => projection([d.longitude, d.latitude])[0])
        .attr("cy", d => projection([d.longitude, d.latitude])[1])
        // Apply the calculated radius based on attack count
        .attr("r", d => radiusScale(d.attack_count)) 
        
        // Styles
        .attr("fill", "red")
        .attr("opacity", 0.7)
        .attr("stroke", "white")
        .attr("stroke-width", 1);

}).catch(function(error) {
    console.error("Error in Promise.all data loading/processing:", error);
    svg.append("text").attr("x", width / 2).attr("y", height / 2).attr("text-anchor", "middle").text("Critical error in data visualization.");
});