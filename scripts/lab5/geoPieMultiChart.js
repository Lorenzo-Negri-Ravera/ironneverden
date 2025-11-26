// File: geoPieMultiChart.js

Promise.all([
    d3.json(GEOJSON_PATH),
    d3.json(ATTACKS_JSON_PATH)
]).then(function([geojson, raw_attacks_data]) {

    // --- 1. SETUP DIMENSIONI E SVG ---
    const width = 1000;
    const height = 650;
    const marginTop = 80;
    
    const svg = d3.select("#geo-pie-multi-chart-container")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto");
    
    // Titolo Principale
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", marginTop / 2)
        .attr("text-anchor", "middle") 
        .attr("class", "graph-title")
        .style("font-size", "24px")
        .style("font-weight", "bold")
        .text("Predominant Attack Type by Region in Ukraine");

    // Sottotitolo Istruzioni
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", marginTop / 2 + 25)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("fill", "#666")
        .text("Click on a region to view detailed statistics. Click outside to reset.");

    // --- 2. ELABORAZIONE DATI ---

    const cleanData = raw_attacks_data.filter(d => d.region_id !== null);
    
    // Lista completa di tutti i tipi di eventi possibili (ordinati)
    const allEventTypes = Array.from(new Set(cleanData.map(d => d.SUB_EVENT_TYPE))).sort();

    // Scala Colori
    const colorScale = d3.scaleOrdinal()
        .domain(allEventTypes)
        .range(["#002677", "#F1C400", "#C8102E"]); 

    // Raggruppamento dati per i dettagli
    const attacksByRegion = d3.rollup(
        cleanData,
        v => d3.sum(v, d => d.count),
        d => d.region_id,
        d => d.SUB_EVENT_TYPE
    );

    // Calcolo "Maggioranza" per colorare la mappa
    const majorityByRegion = new Map();
    attacksByRegion.forEach((typesMap, regionId) => {
        let maxCount = 0;
        let dominantType = null;
        for (const [type, count] of typesMap) {
            if (count > maxCount) {
                maxCount = count;
                dominantType = type;
            }
        }
        if (dominantType) {
            majorityByRegion.set(regionId, { type: dominantType, count: maxCount });
        }
    });

    // --- 3. SETUP MAPPA ---

    const projection = d3.geoMercator()
        .fitExtent([[20, marginTop], [width - 20, height - 60]], geojson); 

    const pathGenerator = d3.geoPath().projection(projection);

    // Rettangolo invisibile per il RESET (dietro la mappa)
    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "transparent")
        .on("click", resetView);

    // Gruppo che contiene la mappa
    const mapLayer = svg.append("g").attr("class", "map-layer");

    // --- 4. SETUP PANNELLO DETTAGLI (Inizialmente nascosto) ---
    
    const panelWidth = 300;
    const panelX = width - panelWidth - 20; // Posizionato in alto a destra
    const panelY = marginTop + 20;

    const detailGroup = svg.append("g")
        .attr("class", "detail-panel")
        .attr("transform", `translate(${panelX}, ${panelY})`)
        .style("display", "none") 
        .style("pointer-events", "none"); // Click passano attraverso se nascosto

    // Sfondo del box (Altezza dinamica gestita dopo)
    const detailBackground = detailGroup.append("rect")
        .attr("width", panelWidth)
        .attr("fill", "white")
        .attr("stroke", "#333")
        .attr("stroke-width", 1)
        .attr("rx", 8) 
        .attr("ry", 8)
        .style("filter", "drop-shadow(3px 3px 5px rgba(0,0,0,0.3))");

    // Titolo del pannello
    const detailTitle = detailGroup.append("text")
        .attr("x", panelWidth / 2)
        .attr("y", 25)
        .attr("text-anchor", "middle")
        .style("font-weight", "bold")
        .style("font-size", "16px")
        .text("Region Name");

    // Contenitore per le barre del grafico
    const chartGroup = detailGroup.append("g")
        .attr("transform", "translate(20, 50)"); // Margine interno superiore

    // --- 5. DISEGNO MAPPA E INTERAZIONE ---

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

    // Gestione Click sulla Regione
    paths.on("click", function(event, d) {
        event.stopPropagation(); // Stop bubbling (altrimenti attiva il reset)
        const regionId = d.properties.id;
        const regionName = d.properties.name || regionId;

        // Effetto "Focus": Sbiadisce gli altri, evidenzia questo
        paths.transition().duration(300).style("opacity", 0.3);
        
        d3.select(this)
            .transition().duration(300)
            .style("opacity", 1)
            .attr("stroke", "#333")
            .attr("stroke-width", 2);

        // Aggiorna e mostra il box
        updateDetailPanel(regionId, regionName);
    });

    // --- 6. FUNZIONE AGGIORNAMENTO BOX (Logica Smart) ---
    function updateDetailPanel(regionId, regionName) {
        const dataMap = attacksByRegion.get(regionId);
        
        // Calcola totale (0 se nessun dato)
        const totalAttacks = dataMap ? Array.from(dataMap.values()).reduce((a, b) => a + b, 0) : 0;

        // Crea array dati includendo TUTTI i tipi (anche quelli a 0)
        const chartData = allEventTypes.map(type => {
            const count = dataMap ? (dataMap.get(type) || 0) : 0;
            return {
                type: type,
                count: count,
                percent: totalAttacks > 0 ? (count / totalAttacks) * 100 : 0
            };
        });

        // Ordina per conteggio decrescente (più frequenti in alto)
        chartData.sort((a, b) => b.count - a.count);

        // Aggiorna Titolo
        detailTitle.text(`${regionName} (Total: ${totalAttacks})`);

        // -- Calcolo Dimensioni Dinamiche --
        const chartW = panelWidth - 40; 
        const barHeight = 12; 
        const labelHeight = 14; 
        const itemGap = 12; // Spazio tra i blocchi
        
        // Altezza di un singolo blocco
        const itemHeight = labelHeight + barHeight + itemGap;

        // Altezza totale dinamica
        const dynamicHeight = 50 + (chartData.length * itemHeight) + 15;
        detailBackground.attr("height", dynamicHeight);

        // Pulisci grafico vecchio
        chartGroup.selectAll("*").remove();

        // Scala X
        const xScale = d3.scaleLinear()
            .domain([0, 100])
            .range([0, chartW]);

        // Disegna gruppi
        const groups = chartGroup.selectAll(".bar-group")
            .data(chartData)
            .join("g")
            .attr("transform", (d, i) => `translate(0, ${i * itemHeight})`);

        // 1. Label (Sopra la barra)
        groups.append("text")
            .attr("x", 0)
            .attr("y", labelHeight - 4)
            .style("font-size", "11px")
            .style("font-weight", "bold")
            .style("fill", "#333")
            .text(d => d.type);

        // 2. Sfondo Barra (Grigio chiaro)
        groups.append("rect")
            .attr("y", labelHeight)
            .attr("width", chartW)
            .attr("height", barHeight)
            .attr("fill", "#f0f0f0")
            .attr("rx", 3);

        // 3. Barra Valore (Colorata)
        groups.append("rect")
            .attr("y", labelHeight)
            .attr("width", 0) // Parte da 0 per animazione
            .attr("height", barHeight)
            .attr("fill", d => colorScale(d.type))
            .attr("rx", 3)
            .transition().duration(500)
            .attr("width", d => xScale(d.percent));

        // 4. Testo Percentuale (A destra)
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

    // --- 7. FUNZIONE RESET ---
    function resetView() {
        // Ripristina mappa
        paths.transition().duration(300)
            .style("opacity", 1)
            .attr("stroke", "#fff")
            .attr("stroke-width", 1);
        
        // Nascondi pannello
        detailGroup.style("display", "none");
    }

    // --- 8. LEGENDA GLOBALE (In basso) ---
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

    // Centra la legenda
    let currentX = 0;
    legendGroups.each(function() {
        const w = this.getBBox().width; 
        d3.select(this).attr("transform", `translate(${currentX}, 0)`);
        currentX += w + legendPadding; 
    });
    legendContainer.attr("transform", `translate(${(width - (currentX - legendPadding)) / 2}, ${legendY})`);

}).catch(function(error) {
    console.error("Error in Promise.all data loading/processing:", error);
    const errSvg = d3.select("#geo-pie-multi-chart-container");
    errSvg.append("text")
        .attr("x", 500).attr("y", 300)
        .attr("text-anchor", "middle")
        .style("fill", "red")
        .text("Critical error in data visualization: check console.");
});