// File: geoSpike.js

const FATALITIES_JSON_PATH = "../../data/lab5/GeoFatalities.json";

Promise.all([
    d3.json(GEOJSON_PATH),
    d3.json(FATALITIES_JSON_PATH)
]).then(function([geojson, raw_fatalities_data]) {

    const width = 1000;
    const height = 600;
    const marginLeft = 10;
    const marginRight = 70;
    const marginBottom = 20;
    const marginTop = 40; 


    // Filter data, dropping records with null region_id, and aggregate by region_id summing the 'count'
    const FatalitiesCountsByRegion = d3.rollups(
        raw_fatalities_data.filter(d => d.region_id !== null), 
        v => d3.sum(v, d => d.count),                       
        d => d.region_id                                    
    );

    // Convert the array into a Map
    const countsMap = new Map(FatalitiesCountsByRegion);

    // Add the 'count' property to each GeoJSON feature
    geojson.features.forEach(feature => {
        const regionId = feature.properties.id;
        feature.properties.count = countsMap.get(regionId) || 0;
        
        // Compute the centroid for the spike 
        const center = d3.geoCentroid(feature);
        feature.properties.centroid = center;
    });

    // Get the maximum count for the color scale domain (usato ora per l'altezza massima)
    const maxCount = d3.max(geojson.features, d => d.properties.count);


    // Build the SVG container
    const svg = d3.select("#geo-spike-container")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto;");

    // Color Scale for the Spike
    const spikeBaseColor = "#C8102E";   // Dark red at the base
    const spikeTopColor = "#fcd199ff"; // Light red/beige at the top

    const colorScale = d3.scaleLinear()
        .domain([0, maxCount]) 
        .range([spikeTopColor, spikeBaseColor]); 


    // Projection: Ukraine map centered and scaled
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

    // Draw the Map
    svg.append("g")
        .attr("class", "regions")
        .attr("transform", `translate(${marginLeft}, ${marginTop})`) 
        .selectAll("path")
        .data(geojson.features)
        .join("path")
        .attr("d", path)
        .attr("fill", "#ccc") 
        .attr("stroke", "#fff") 
        .attr("stroke-width", 0.8);

    // Scale for Spike Height
    const maxSpikeHeight = 150; 
    const spikeHeightScale = d3.scaleSqrt()     // used a Square Scale for better visual effect
        .domain([0, maxCount])
        .range([0, maxSpikeHeight]);

    // Width of the Spike Base
    const spikeBaseWidth = 8; 

    // Draw Spikes Group
    const spikesGroup = svg.append("g")
        .attr("class", "spikes")
        .attr("transform", `translate(${marginLeft}, ${marginTop})`);

    // Enable SVG Definitions for Gradients
    const defs = svg.append("defs");

    // Draw Spikes
    spikesGroup.selectAll("path.spike")
        .data(geojson.features.filter(d => d.properties.count > 0)) 
        .join(
            enter => {
                const group = enter.append("g").attr("class", "spike-group");

                group.each(function(d, i) {
                    const spikeGradient = defs.append("linearGradient")
                        .attr("id", `spike-gradient-${d.properties.id}`)
                        .attr("x1", "0%")
                        .attr("y1", "100%") 
                        .attr("x2", "0%")
                        .attr("y2", "0%");  

                    spikeGradient.append("stop")
                        .attr("offset", "0%")
                        .attr("stop-color", spikeBaseColor); 

                    spikeGradient.append("stop")
                        .attr("offset", "100%")
                        .attr("stop-color", spikeTopColor) 
                        .attr("stop-opacity", 0.8); 
                });

                group.append("path")
                    .attr("class", "spike")
                    .attr("d", d => {
                        const centroid = projection(d.properties.centroid);
                        const spikeHeight = spikeHeightScale(d.properties.count);
                        const x = centroid[0];
                        const y = centroid[1];
                        // Draw a triangle for the spike with base centered and height upwards
                        return `M ${x - spikeBaseWidth / 2},${y} ` + 
                               `L ${x + spikeBaseWidth / 2},${y} ` + 
                               `L ${x},${y - spikeHeight} Z`;       
                    })
                    .attr("fill", d => `url(#spike-gradient-${d.properties.id})`)
                    .attr("stroke", spikeBaseColor) 
                    .attr("stroke-width", 0.5)
                    .on("mouseover", function(event, d) {
                        d3.select(this).attr("stroke-width", 1.5); // Highlight on the boundary
                        tooltip.transition()
                            .duration(200)
                            .style("opacity", .9);
                        tooltip.html(`Region: ${d.properties.name}<br>Fatalities: ${d.properties.count}`)
                            .style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY - 28) + "px");
                    })
                    .on("mousemove", function(event) {
                        tooltip.style("left", (event.pageX + 10) + "px")
                               .style("top", (event.pageY - 28) + "px");
                    })
                    .on("mouseout", function(event, d) {
                        d3.select(this).attr("stroke-width", 0.5); // Restore original width
                        tooltip.transition()
                            .duration(500)
                            .style("opacity", 0);
                    });
                return group;
            },
            update => { 
                update.select(".spike")
                    .attr("d", d => {
                        const centroid = projection(d.properties.centroid);
                        const spikeHeight = spikeHeightScale(d.properties.count);
                        const x = centroid[0];
                        const y = centroid[1];
                        return `M ${x - spikeBaseWidth / 2},${y} ` + 
                               `L ${x + spikeBaseWidth / 2},${y} ` + 
                               `L ${x},${y - spikeHeight} Z`;       
                    })
                    .attr("fill", d => `url(#spike-gradient-${d.properties.id})`);
                return update;
            },
            exit => exit.remove()
        );


    // Title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", marginTop / 2)
        .attr("text-anchor", "middle") 
        .attr("class", "graph-title")
        .text("Geographic distribution of fatalities on Ukraine soil during the conflict");

    // Draw Spike Legend
    const legendData = [
        Math.ceil(maxCount * 0.05), // 1% of max
        Math.floor(maxCount * 0.1), // 10% of max
        Math.floor(maxCount * 0.5),  // 50% of max
        maxCount
    ];
    const legendX = width - marginRight - 10;
    const legendY = height - marginBottom - maxSpikeHeight - 20; 

    const legendGroup = svg.append("g")
        .attr("class", "spike-legend")
        .attr("transform", `translate(${legendX}, ${legendY})`);

    legendGroup.selectAll("g.legend-item")
        .data(legendData)
        .join("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(${i * (spikeBaseWidth + 10)}, 0)`) 
        .each(function(d) {
            const currentGroup = d3.select(this);
            const spikeHeight = spikeHeightScale(d);

            const legendGradient = defs.append("linearGradient")
                .attr("id", `legend-spike-gradient-${d}`)
                .attr("x1", "0%")
                .attr("y1", "100%") 
                .attr("x2", "0%")
                .attr("y2", "0%");

            legendGradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", spikeBaseColor);

            legendGradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", spikeTopColor)
                .attr("stop-opacity", 0.8);

            currentGroup.append("path")
                .attr("d", `M ${-spikeBaseWidth / 2},${maxSpikeHeight} ` + 
                           `L ${spikeBaseWidth / 2},${maxSpikeHeight} ` +  
                           `L 0,${maxSpikeHeight - spikeHeight} Z`)        
                .attr("fill", `url(#legend-spike-gradient-${d})`)
                .attr("stroke", spikeBaseColor)
                .attr("stroke-width", 0.5);

            // Legend text, below the spike
            currentGroup.append("text")
                .attr("x", 0)
                .attr("y", maxSpikeHeight + 15) 
                .attr("text-anchor", "middle")
                .attr("font-size", "10px")
                .attr("fill", "#333")
                .text(d3.format(".0s")(d)); 
        });

}).catch(function(error) {
    console.error("Error loading data:", error);
});