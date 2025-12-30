// File: conflictMap.js

const UKR_PATH = "../../data/final/geojson/countries/UKR.json";
const RUS_PATH = "../../data/final/geojson/countries/RUS.json";
// const BATTLES_PATH = "../../data/lab5/battles.json"; // <--- DECOMMENTA QUANDO AVRAI IL FILE

Promise.all([
    d3.json(UKR_PATH),
    d3.json(RUS_PATH),
    // d3.json(BATTLES_PATH) // <--- DECOMMENTA QUANDO AVRAI IL FILE
]).then(function([ukrGeo, rusGeo /*, battlesData */]) { 
    
    // --- 1. SETUP DIMENSIONI E MARGINI (Standardizzati dal Codice 1) ---
    const width = 1000;
    const height = 700;
    const marginLeft = 40;
    const marginRight = 40;
    const marginBottom = 50;
    const marginTop = 50; 

    const mapWidth = width - (marginRight * 2); 
    const mapHeight = height - marginTop - marginBottom;

    // --- 2. SETUP SVG ---
    const svg = d3.select("#front-map-container") 
        .attr("viewBox", [0, 0, width, height])
        .style("border", "0.5px solid #999")
        .style("background-color", "#f9f9f9");

    const projection = d3.geoMercator();
    const pathGenerator = d3.geoPath().projection(projection);

    // Gruppo per la mappa (Standardizzato dal Codice 1)
    const mapGroup = svg.append("g")
        .attr("transform", `translate(${marginLeft}, ${marginTop})`);

    // --- 3. PREPARAZIONE DATI ---
    const westernRussiaIds = [
        "RUORL", "RUBEL", "RUKRS", "RUBRY", "RUVOR", "RUROS", "RUVGG", "RUTAM", "RULIP",
        "RUMOS", "RUMOW", // Mosca
        "RUKL", "RUKLU", "RUTUL", "RURYA" // Regioni per collegare Mosca
        //"RUVLA", "RUYAR", "RUTVE", 
        //"RUSMO", //"RUPNZ", , //"RUSAR", "RUIVA"  
    ]; 

    const rusFeatures = rusGeo.features.filter(d => westernRussiaIds.includes(d.properties.id));
    const combinedFeatures = [
        ...ukrGeo.features.map(d => ({ ...d, country: "Ukraine" })),
        ...rusFeatures.map(d => ({ ...d, country: "Russia" }))
    ];

    const combinedGeoJSON = { type: "FeatureCollection", features: combinedFeatures };

    // Adattamento proiezione (Standardizzato dal Codice 1)
    projection.fitSize([mapWidth, mapHeight], combinedGeoJSON);    
    
    // --- 4. DISEGNO MAPPA GEOGRAFICA ---

    // Definiamo un filtro per l'ombra/bordo nero esterno
    // Questo crea un contorno nero netto attorno alla silhouette del gruppo
    svg.append("defs")
        .append("filter")
        .attr("id", "outer-border")
        .append("feDropShadow")
        .attr("dx", 0) 
        .attr("dy", 0) 
        .attr("stdDeviation", 1.5) // Regola questo per la nitidezza (0.5 = netto, 2 = sfumato)
        .attr("flood-color", "#000000"); // Colore del confine esterno

    // 4.1 Gruppo Ucraina
    const ukraineGroup = mapGroup.append("g")
        .attr("id", "ukraine-group")
        .style("filter", "url(#outer-border)"); // Applica il bordo nero solo all'esterno

    ukraineGroup.selectAll(".region-ukr")
        .data(ukrGeo.features)
        .join("path")
        .attr("class", "region-ukr")
        .attr("d", pathGenerator)
        .attr("fill", "#888888")
        .attr("stroke", "#ffffff") // Confini interni bianchi
        .attr("stroke-width", 0.5);

    // 4.2 Gruppo Russia (Regioni Occidentali)
    const russiaGroup = mapGroup.append("g")
        .attr("id", "russia-group")
        .style("filter", "url(#outer-border)"); // Applica il bordo nero solo all'esterno

    russiaGroup.selectAll(".region-rus")
        .data(rusFeatures)
        .join("path")
        .attr("class", "region-rus")
        .attr("d", pathGenerator)
        .attr("fill", "#e5e5e5")
        .attr("stroke", "#ffffff") // Confini interni bianchi
        .attr("stroke-width", 0.5);

    /* NOTA PER MODIFICHE FUTURE:
    - Per cambiare il colore del bordo esterno: modifica "flood-color" nel filtro sopra.
    - Per cambiare lo spessore del bordo esterno: modifica "stdDeviation".
    - Per cambiare i confini interni: modifica "stroke" e "stroke-width" dentro le sezioni 4.1 e 4.2.
    */

    // --- 4.3 LOGICA PER IL CONFINE CONDIVISO (FRONTIERA) ---

    // 1. Creiamo una maschera basata sulla forma della Russia
    // Questa maschera dice: "mostra solo ciò che sta dentro i confini russi"
    svg.append("defs")
        .append("clipPath")
        .attr("id", "clip-russia")
        .append("path")
        .datum({type: "FeatureCollection", features: rusFeatures}) // Usiamo le regioni russe selezionate
        .attr("d", pathGenerator);

    // 2. Disegniamo il confine dell'Ucraina usando la maschera appena creata
    // Essendo clippato sulla Russia, si vedrà SOLO il tratto dove l'Ucraina tocca la Russia
    mapGroup.append("path")
        .datum(ukrGeo) // Prendiamo l'intera Ucraina
        .attr("d", pathGenerator)
        .attr("fill", "none")
        .attr("stroke", "#ff0000") // <--- QUI PUOI PERSONALIZZARE IL COLORE (es. Rosso, o Nero più spesso)
        .attr("stroke-width", 2)    // <--- QUI PERSONALIZZI LO SPESSORE del solo confine comune
        .attr("clip-path", "url(#clip-russia)") // Applichiamo il ritaglio
        .attr("pointer-events", "none")
        .attr("stroke-linecap", "round");


    // --- 5. TITOLO PRINCIPALE (Standardizzato dal Codice 1) ---
    svg.append("text")
        .attr("class", "graph-title")
        .attr("x", width / 2)
        .attr("y", marginTop / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .text("Battlefront Map: Ukraine vs Russia");

    /* ============================================================
       LOGICA PER LE BATTAGLIE (DA DECOMMENTARE IN FUTURO)
       ============================================================ */
    
    /*
    const eventGroup = mapGroup.append("g"); // Usiamo mapGroup per coerenza coordinate
    const tooltip = d3.select("#tooltip");

    function updateEvents(year) {
        const filteredData = battlesData.filter(d => +d.year === +year);

        eventGroup.selectAll("circle")
            .data(filteredData)
            .join("circle")
            .attr("cx", d => projection([+d.longitude, +d.latitude])[0])
            .attr("cy", d => projection([+d.longitude, +d.latitude])[1])
            .attr("r", 6)
            .attr("fill", "red")
            .attr("opacity", 0.7)
            .on("mouseover", (event, d) => {
                tooltip.style("opacity", 1).html(d.description);
            })
            .on("mousemove", (event) => {
                tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
            })
            .on("mouseout", () => tooltip.style("opacity", 0));
    }

    d3.select("#year-slider").on("input", function() {
        const val = +this.value;
        d3.select("#year-display").text(val);
        updateEvents(val);
    });

    updateEvents(2022);
    */

    // --- 6. HOW TO READ THE CHART? (Standardizzato dal Codice 1) ---
    setupHelpButton(svg, width, height, {
        x: 30,
        y: height-20,
        title: "Disorders in Europe",
        instructions: [
            "1. Dark intensity means more events.",
            "2. Hover on a country to see the number.",
            "3. Click on a country for details"
        ]
    });

}).catch(err => {
    console.error("ERRORE CARICAMENTO DATI:", err);
});