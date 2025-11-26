// File: geoPieMultiChart.js

Promise.all([
    d3.json(GEOJSON_PATH),
    d3.json(ATTACKS_JSON_PATH)
]).then(function([geojson, raw_attacks_data]) {

    // Define SVG dimensions
    const width = 1000;
    const height = 650; // Aumentato leggermente per dare respiro
    const marginTop = 80; // Spazio per il titolo
    
    // Select the SVG container element
    const svg = d3.select("#geo-pie-multi-chart-container")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto");
    
    // Titolo (posizionato nel margine superiore)
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", marginTop / 2)
        .attr("text-anchor", "middle") 
        .attr("class", "graph-title")
        .text("Distribution of Different Types of Attacks in Ukraine by Region");

    // --- 1. DATA PROCESSING ---

    const cleanData = raw_attacks_data.filter(d => d.region_id !== null);
    const allEventTypes = Array.from(new Set(cleanData.map(d => d.SUB_EVENT_TYPE))).sort();

    const colorScale = d3.scaleOrdinal()
        .domain(allEventTypes)
        .range(["#002677", "#F1C400", "#C8102E"]); 

    const attacksByRegion = d3.rollup(
        cleanData,
        v => d3.sum(v, d => d.count),
        d => d.region_id,
        d => d.SUB_EVENT_TYPE
    );

    // --- 2. MAP SETUP ---

    // *** CORREZIONE QUI ***
    // Usiamo fitExtent per definire i confini esatti:
    // Angolo in alto a sinistra: [0, marginTop] -> La mappa inizia DOPO il titolo
    // Angolo in basso a destra: [width, height - 50] -> Lascia spazio per la legenda
    const projection = d3.geoMercator()
        .fitExtent([[20, marginTop], [width - 20, height - 60]], geojson); 

    const pathGenerator = d3.geoPath().projection(projection);

    const mapLayer = svg.append("g").attr("class", "map-layer");
    const chartsLayer = svg.append("g").attr("class", "charts-layer");

    // --- 3. DRAW BASE MAP ---

    mapLayer.selectAll("path")
        .data(geojson.features)
        .join("path")
        .attr("d", pathGenerator)
        .attr("fill", "#ccc") 
        .attr("stroke", "#fff") 
        .attr("stroke-width", 1);

    // --- 4. DRAW PIE CHARTS ---

    const pieRadius = 20; 
    const pieGenerator = d3.pie()
        .value(d => d[1])
        .sort(null);

    const arcGenerator = d3.arc()
        .innerRadius(0)
        .outerRadius(pieRadius);

    geojson.features.forEach(feature => {
        const regionId = feature.properties.id;
        const centroid = pathGenerator.centroid(feature);
        
        if (!centroid || isNaN(centroid[0]) || isNaN(centroid[1])) return;
        
        let [x, y] = centroid;

        // --- CORREZIONE SOVRAPPOSIZIONE ---
        // Nota: Qui avevi messo UA30 (Kyiv Città). Se vuoi spostare 
        // la città sotto la regione circostante va bene.
        if (regionId === "UA30") {
            y += 30; 
            x += 10; 
        }
        // Se invece volevi spostare UA32 (Kyiv Oblast) come discusso prima:
        /*
        if (regionId === "UA32") {
            y += 45; 
            x += 10; 
        }
        */

        const regionDataMap = attacksByRegion.get(regionId);

        if (regionDataMap) {
            const dataArray = Array.from(regionDataMap);

            const pieGroup = chartsLayer.append("g")
                .attr("transform", `translate(${x}, ${y})`);

            pieGroup.selectAll("path")
                .data(pieGenerator(dataArray))
                .join("path")
                .attr("d", arcGenerator)
                .attr("fill", d => colorScale(d.data[0]))
                .attr("stroke", "white")
                .attr("stroke-width", 0.5)
                .attr("opacity", 0.9);
            
            pieGroup.selectAll("path")
                .append("title")
                .text(d => `${d.data[0]}: ${d.data[1]} attacks`);
        }
    });

    // --- 5. LEGEND ---

    const legendItemSize = 15;   
    const legendPadding = 30;    
    const legendY = height - 30; // Posizione dal fondo

    const legendContainer = svg.append("g")
        .attr("class", "legend-container");

    const legendGroups = legendContainer.selectAll("g")
        .data(allEventTypes)
        .join("g");

    legendGroups.append("rect")
        .attr("width", legendItemSize)
        .attr("height", legendItemSize)
        .attr("fill", d => colorScale(d));

    legendGroups.append("text")
        .attr("x", legendItemSize + 5) 
        .attr("y", 12)                  
        .text(d => d)
        .attr("class", "legend-text");

    let currentX = 0;
    
    legendGroups.each(function() {
        const width = this.getBBox().width; 
        d3.select(this).attr("transform", `translate(${currentX}, 0)`);
        currentX += width + legendPadding; 
    });

    const totalLegendWidth = currentX - legendPadding; 
    const startX = (width - totalLegendWidth) / 2;

    legendContainer.attr("transform", `translate(${startX}, ${legendY})`);

}).catch(function(error) {
    console.error("Error in Promise.all data loading/processing:", error);
    const errSvg = d3.select("#geo-pie-multi-chart-container");
    errSvg.append("text")
        .attr("x", 500)
        .attr("y", 300)
        .attr("text-anchor", "middle")
        .style("fill", "red")
        .text("Critical error in data visualization: check console.");
});