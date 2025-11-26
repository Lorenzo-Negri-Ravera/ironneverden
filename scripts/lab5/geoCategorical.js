// File: geoCategorical.js

Promise.all([
    d3.json(GEOJSON_PATH),
    d3.json(ATTACKS_JSON_PATH)
]).then(function([geojson, raw_attacks_data]) {

    // svg dimensions
    const width = 1000;
    const height = 650;
    const marginTop = 80;
    const marginBottom = 60;
    
    //  building SVG container
    const svg = d3.select("#geo-categorical-container")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto");
    
    // Main Title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", marginTop / 2)
        .attr("text-anchor", "middle") 
        .attr("class", "graph-title")
        .style("font-size", "24px")
        .style("font-weight", "bold")
        .text("Predominant Attack Type by Region in Ukraine");

    // Instruction Subtitle
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", marginTop / 2 + 25)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("fill", "#666")
        .text("Click on a region to view detailed statistics. Click outside to reset.");


    // remove entries located on the sea (region_id null)
    const cleanData = raw_attacks_data.filter(d => d.region_id !== null);
    
    // Complete list of all possible event types (sorted)
    const allEventTypes = Array.from(new Set(cleanData.map(d => d.SUB_EVENT_TYPE))).sort();

    // Color Scale
    const colorScale = d3.scaleOrdinal()
        .domain(allEventTypes)
        .range(["#002677", "#F1C400", "#C8102E"]); 

    // Grouping data
    const attacksByRegion = d3.rollup(
        cleanData,
        v => d3.sum(v, d => d.count),
        d => d.region_id,
        d => d.SUB_EVENT_TYPE
    );

    // Calculate "Majority" for coloring the map
    const majorityByRegion = new Map();
    attacksByRegion.forEach((typesMap, regionId) => {
        let maxCount = 0;
        let dominantType = null;
        for (const [type, count] of typesMap) {
            if (count >= maxCount) {
                maxCount = count;
                dominantType = type;
            }
        }
        if (dominantType) {
            majorityByRegion.set(regionId, { type: dominantType, count: maxCount });
        }
    });


    // building the map projection
    const projection = d3.geoMercator()
        .fitExtent([[20, marginTop], [width - 20, height - 60]], geojson); 

    const pathGenerator = d3.geoPath().projection(projection);

    // Invisible rectangle for RESET (behind the map)
    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "transparent")
        .on("click", resetView);

    const mapLayer = svg.append("g").attr("class", "map-layer");

  
    // detail panel
    const panelWidth = 300;
    const panelX = 50; // Positioned in bottom left corner
    const panelY = height - marginBottom-200; // Adjusted to place it at the bottom

    const detailGroup = svg.append("g")
        .attr("class", "detail-panel")
        .attr("transform", `translate(${panelX}, ${panelY})`)
        .style("display", "none") 
        .style("pointer-events", "none");

    
    const detailBackground = detailGroup.append("rect")
        .attr("width", panelWidth)
        .attr("fill", "white")
        .attr("stroke", "#333")
        .attr("stroke-width", 1)
        .attr("rx", 8) 
        .attr("ry", 8)
        .style("filter", "drop-shadow(3px 3px 5px rgba(0,0,0,0.3))");

    const detailTitle = detailGroup.append("text")
        .attr("x", panelWidth / 2)
        .attr("y", 25)
        .attr("text-anchor", "middle")
        .style("font-weight", "bold")
        .style("font-size", "16px")
        .text("Region Name");

    // detail bar chart group
    const chartGroup = detailGroup.append("g")
        .attr("transform", "translate(20, 50)");


    // coloring the map based on majority attack type
    const paths = mapLayer.selectAll("path")
        .data(geojson.features)
        .join("path")
        .attr("d", pathGenerator)
        .attr("stroke", "#fff") 
        .attr("stroke-width", 1)
        .attr("cursor", "pointer")
        .attr("fill", d => {
            const regionId = d.properties.id;
            const majorityData = majorityByRegion.get(regionId);
            return majorityData ? colorScale(majorityData.type) : "#ccc";
        });

    // managing click events on regions
    paths.on("click", function(event, d) {
        event.stopPropagation();
        const regionId = d.properties.id;
        const regionName = d.properties.name || regionId;

        // reset of borders and opacity
        paths.transition().duration(300)
            .style("opacity", 0.3)
            .attr("stroke", "#fff")
            .attr("stroke-width", 1);
        
        // highlight selected region
        d3.select(this)
            .transition().duration(300)
            .style("opacity", 1)
            .attr("stroke", "#333")
            .attr("stroke-width", 2);

        // update and show the detail panel
        updateDetailPanel(regionId, regionName);
    });

    // function to update detail panel
    function updateDetailPanel(regionId, regionName) {
        const dataMap = attacksByRegion.get(regionId);
        
        // compute total attacks
        const totalAttacks = dataMap ? Array.from(dataMap.values()).reduce((a, b) => a + b, 0) : 0;
        
        // build bars data
        const chartData = allEventTypes.map(type => {
            const count = dataMap ? (dataMap.get(type) || 0) : 0;
            return {
                type: type,
                count: count,
                percent: totalAttacks > 0 ? (count / totalAttacks) * 100 : 0
            };
        });

        // bars sorted by count descending
        chartData.sort((a, b) => b.count - a.count);

        // update title
        detailTitle.text(`${regionName} (Total: ${totalAttacks})`);

        // compute dimensions of the chart
        const chartW = panelWidth - 40; 
        const barHeight = 12; 
        const labelHeight = 14; 
        const itemGap = 12;
        
        // height of a single block
        const itemHeight = labelHeight + barHeight + itemGap;

        // dynamic total height
        const dynamicHeight = 50 + (chartData.length * itemHeight) + 15;
        detailBackground.attr("height", dynamicHeight);

        // clear old chart
        chartGroup.selectAll("*").remove();

        // X scale
        const xScale = d3.scaleLinear()
            .domain([0, 100])
            .range([0, chartW]);

        // Draw groups
        const groups = chartGroup.selectAll(".bar-group")
            .data(chartData)
            .join("g")
            .attr("transform", (d, i) => `translate(0, ${i * itemHeight})`);

        // bar label
        groups.append("text")
            .attr("x", 0)
            .attr("y", labelHeight - 4)
            .style("font-size", "11px")
            .style("font-weight", "bold")
            .style("fill", "#333")
            .text(d => d.type);

        // bar background
        groups.append("rect")
            .attr("y", labelHeight)
            .attr("width", chartW)
            .attr("height", barHeight)
            .attr("fill", "#f0f0f0")
            .attr("rx", 3);

        // colored bar
        groups.append("rect")
            .attr("y", labelHeight)
            .attr("width", 0) // starts at 0 for animation
            .attr("height", barHeight)
            .attr("fill", d => colorScale(d.type))
            .attr("rx", 3)
            .transition().duration(500)
            .attr("width", d => xScale(d.percent));

        // Percentage text
        groups.append("text")
            .attr("x", chartW)
            .attr("y", labelHeight + barHeight - 2)
            .attr("text-anchor", "end")
            .style("font-size", "10px")
            .style("fill", "#555")
            .text(d => `${d.percent.toFixed(1)}%`);

        // Mostra pannello
        detailGroup.style("display", null);
    }

    // Reset function
    function resetView() {
        paths.transition().duration(300)
            .style("opacity", 1)
            .attr("stroke", "#fff")
            .attr("stroke-width", 1);
        
        detailGroup.style("display", "none");
    }

    // legend
    const legendItemSize = 15;   
    const legendPadding = 30;    
    const legendY = height - 30; 

    const legendContainer = svg.append("g").attr("class", "legend-container");
    
    const legendGroups = legendContainer.selectAll("g")
        .data(allEventTypes).join("g");

    legendGroups.append("rect")
        .attr("width", legendItemSize).attr("height", legendItemSize)
        .attr("fill", d => colorScale(d));

    legendGroups.append("text")
        .attr("x", legendItemSize + 5).attr("y", 12)                  
        .text(d => d).attr("class", "legend-text");

    let currentX = 0;
    legendGroups.each(function() {
        const w = this.getBBox().width; 
        d3.select(this).attr("transform", `translate(${currentX}, 0)`);
        currentX += w + legendPadding; 
    });
    legendContainer.attr("transform", `translate(${(width - (currentX - legendPadding)) / 2}, ${legendY})`);

}).catch(function(error) {
    console.error("Error in Promise.all data loading/processing:", error);
    const errSvg = d3.select("#geo-categorical-container");
    errSvg.append("text")
        .attr("x", 500).attr("y", 300)
        .attr("text-anchor", "middle")
        .style("fill", "red")
        .text("Critical error in data visualization: check console.");
});