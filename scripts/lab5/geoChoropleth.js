// File: geoChoropleth.js

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
    const svg = d3.select("#geo-choropleth-container")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto");

    // --- AGGREGAZIONE MODIFICATA PER CHOROPLETH ---
    // Aggrega i conteggi di attacco per CODICE REGIONE (d.CODE)
    const attack_count_by_region = new Map();
    let maxAttackCount = 0;
    
    // Passaggio 1: Aggregare il conteggio totale degli attacchi per codice regione (d.CODE)
    raw_attacks_data.forEach(d => {
        // Assumiamo che GeoAttacks.json contenga il codice regione sotto la chiave 'CODE' o simile.
        // Se nel tuo GeoAttacks.json la chiave è diversa (es. REGION_CODE), devi cambiarla qui.
        const regionCode = d.CODE; 
        const count = +d.count || 0; 
        
        if (regionCode) {
            const currentCount = (attack_count_by_region.get(regionCode) || 0) + count;
            attack_count_by_region.set(regionCode, currentCount);
            
            if (currentCount > maxAttackCount) {
                maxAttackCount = currentCount;
            }
        }
    });
    // --------------------------------------------------

    // Passaggio 2: Definizione della Scala Colore (Choropleth)
    const colorScale = d3.scaleSequential(d3.interpolateReds)
        .domain([0, maxAttackCount]); // Colore da 0 (bianco) a maxAttackCount (rosso scuro)

    
    // --- PROIEZIONE (INVARIATA) ---
    const projection = d3.geoMercator();    

    // Calculate the geographical center
    const center = d3.geoCentroid(geojson);

    // Automatically fit the projection to the SVG extent
    projection
        .center(center) 
        .fitExtent(
            // Extent (pixel boundaries) for the map, adding a 10px padding
            [[marginLeft, 10], [width - marginRight, height - 10]], 
            geojson // GeoJSON object to fit
        );
        
    // Recreate the path generator with the adapted projection
    const updatedPath = d3.geoPath().projection(projection);

    
    // Passaggio 3: Disegno della Mappa Choropleth
    // Usiamo il codice regione (d.properties.CODE) per mappare i dati di attacco
    svg.selectAll(".region-boundary")
        .data(geojson.features)
        .join("path")
        .attr("class", "region-boundary")
        .attr("d", updatedPath) 
        // Modifica chiave principale: Riempire in base al conteggio degli attacchi per codice regione
        .attr("fill", d => {
            const code = d.properties.CODE; // Assumiamo che il GeoJSON abbia 'properties.CODE'
            const count = attack_count_by_region.get(code) || 0;
            return colorScale(count);
        }) 
        .attr("stroke", "#333") 
        .attr("stroke-width", 0.5);
    
    
    // --- RIMOSSO IL CODICE DELLO SCATTER PLOT ---
    // Il codice per radiusScale e .attack-dot è stato rimosso in quanto non necessario.


}).catch(function(error) {
    console.error("Error in Promise.all data loading/processing:", error);
    d3.select("#geo-choropleth-container").append("text").attr("x", width / 2).attr("y", height / 2).attr("text-anchor", "middle").text("Critical error in data visualization.");
});