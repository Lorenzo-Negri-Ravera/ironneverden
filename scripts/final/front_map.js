// File: front_map.js (Fixed Responsive Version + Filters Working)

// --- PERCORSI PAESI ---
const UKR_PATH = "../../data/final/geojson/countries/UKR.json";
const RUS_PATH = "../../data/final/geojson/countries/RUS.json";
// Nuovi Paesi Confinanti
const MDA_PATH = "../../data/final/geojson/countries/MDA.geojson"; 
const ROU_PATH = "../../data/final/geojson/countries/ROU.geojson"; 
const HUN_PATH = "../../data/final/geojson/countries/HUN.geojson"; 
const SVK_PATH = "../../data/final/geojson/countries/SVK.geojson"; 
const POL_PATH = "../../data/final/geojson/countries/POL.geojson"; 
const BLR_PATH = "../../data/final/geojson/countries/BLR.geojson"; 
const BGR_PATH = "../../data/final/geojson/countries/BGR.geojson"; 

const FRONT_UKR_PATH = "../../data/final/front_UKR.csv";
const FRONT_RU_PATH = "../../data/final/front_RU.csv";

const parseDate = d3.timeParse("%Y-%m-%d");

Promise.all([
    d3.json(UKR_PATH),
    d3.json(RUS_PATH),
    d3.json(MDA_PATH),
    d3.json(ROU_PATH),
    d3.json(HUN_PATH),
    d3.json(SVK_PATH),
    d3.json(POL_PATH),
    d3.json(BLR_PATH),
    d3.json(BGR_PATH),
    d3.csv(FRONT_UKR_PATH),
    d3.csv(FRONT_RU_PATH)
]).then(function([
    ukrGeo, rusGeo, 
    mdaGeo, rouGeo, hunGeo, svkGeo, polGeo, blrGeo, bgrGeo,
    ukrBattlesData, ruBattlesData
]) { 

    // --- 0. SETUP LOADER ---
    const container = d3.select("#front-map-container");
    container.html(""); // Pulisci eventuale loader precedente
    
    // --- 1. SETUP DIMENSIONI ---
    const width = 1000;
    const height = 700;
    
    // --- 2. PREPARAZIONE DATI GEOGRAFICI ---
    
    const neighborsFeatures = [
        ...mdaGeo.features, ...rouGeo.features, ...hunGeo.features,
        ...svkGeo.features, ...polGeo.features, ...blrGeo.features, ...bgrGeo.features
    ];

    const westernRussiaIds = [
        "RUORL", "RUBEL", "RUKRS", "RUBRY", "RUVOR", "RUROS", "RUVGG", "RUTAM", 
        "RULIP", "RUMOS", "RUMOW", "RUKLU", "RUTUL", "RURYA", "RUAST", "RUKL", 
        "RUSTA", "RUKDA", "RUSAR", "RUPNZ", "RUDA"
    ]; 
    
    const visibleRusFeatures = rusGeo.features.filter(d => westernRussiaIds.includes(d.properties.id));
    const restOfRusFeatures = rusGeo.features.filter(d => !westernRussiaIds.includes(d.properties.id));
    
    const projection = d3.geoConicConformal()
        .parallels([44, 52])
        .rotate([-31, 0]);

    const extentFeatures = { type: "FeatureCollection", features: [...ukrGeo.features, ...visibleRusFeatures] };

    const ZOOM_LEVEL = 1.25; 
    const expandedWidth = (width * 0.9) * ZOOM_LEVEL;
    const expandedHeight = (height - 30) * ZOOM_LEVEL;
    const dx = (width - expandedWidth) / 2;
    const dy = (height - expandedHeight) / 2;

    projection.fitExtent(
        [[dx, dy], [dx + expandedWidth, dy + expandedHeight]], 
        extentFeatures
    );
    
    const currentTranslate = projection.translate();
    projection.translate([
        currentTranslate[0] + 55,  
        currentTranslate[1] - 80 
    ]);

    const pathGenerator = d3.geoPath().projection(projection);

    const processData = (data, type) => {
        data.forEach(d => {
            d.date = parseDate(d.event_date);
            d.datasetType = type; 
            const coords = projection([+d.longitude, +d.latitude]);
            if (coords) { d.x = coords[0]; d.y = coords[1]; }
        });
        return data;
    };

    const allBattlesRaw = [...processData(ukrBattlesData, 'UKR'), ...processData(ruBattlesData, 'RUS')];
    const allBattlesData = allBattlesRaw.filter(d => !isNaN(d.x) && !isNaN(d.y));
    allBattlesData.sort((a, b) => a.date - b.date);
    
    const days = d3.timeDays(d3.min(allBattlesData, d => d.date), d3.max(allBattlesData, d => d.date));

    // --- 4. SETUP CONTENITORI (MODIFICATO PER RESPONSIVE) ---
    
    container
        .style("position", "relative") 
        .style("width", "100%")       // Occupa tutta la larghezza disponibile
        .style("height", "auto")      // Altezza automatica...
        .style("aspect-ratio", "1000 / 700") // ...ma vincolata alla proporzione!
        .style("background-color", "#f8f9fa") 
        .style("border", "1px solid #dee2e6")  
        .style("border-radius", "8px")         
        .style("margin", "0 auto")
        .style("overflow", "hidden"); 

    const svg = container.append("svg")
        .attr("viewBox", [0, 0, width, height])
        .style("position", "absolute")
        .style("top", 0)
        .style("left", 0)
        .style("width", "100%")   // Si adatta al container
        .style("height", "100%")  // Si adatta al container
        .style("z-index", 1);

    const mapGroup = svg.append("g");

    const defs = mapGroup.append("defs");
    defs.append("clipPath")
        .attr("id", "clip-russia-full-mask")
        .selectAll("path")
        .data(rusGeo.features) 
        .join("path")
        .attr("d", pathGenerator);

    const tooltip = d3.select("body").selectAll(".tooltip-geo").data([0]).join("div")
        .attr("class", "tooltip-geo")
        .style("position", "absolute")
        .style("background", "rgba(255, 255, 255, 0.95)")
        .style("padding", "6px 10px")
        .style("border", "1px solid #999")
        .style("border-radius", "8px")
        .style("pointer-events", "none")
        .style("font-size", "12px")
        .style("font-family", "sans-serif")
        .style("opacity", 0)
        .style("z-index", 9999);

    const handleMouseOver = function(event, d) {
        d3.select(this).attr("fill-opacity", 0.8);
        const regionName = d.properties.COUNTRY || d.properties.name || d.properties.NAME || "Region";
        tooltip.style("opacity", 1).text(regionName);
    };

    const handleMouseMove = function(event) {
        tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
    };

    const handleMouseOut = function() {
        d3.select(this).attr("fill-opacity", 1); 
        tooltip.style("opacity", 0);
    };

    // --- DISEGNO MAPPA ---
    // 1. Vicini
    mapGroup.append("g").selectAll("path").data(neighborsFeatures).join("path")
        .attr("d", pathGenerator).attr("fill", "#e9ecef").attr("stroke", "#ffffff").attr("stroke-width", 1)
        .on("mouseover", handleMouseOver).on("mousemove", handleMouseMove).on("mouseout", handleMouseOut);

    // 2. Russia Resto
    mapGroup.append("g").selectAll("path").data(restOfRusFeatures).join("path")
        .attr("d", pathGenerator).attr("fill", "#cfd2d6").attr("fill-opacity", 1).attr("stroke", "#ffffff").attr("stroke-width", 0.5)
        .on("mouseover", handleMouseOver).on("mousemove", handleMouseMove).on("mouseout", handleMouseOut);

    // 3. Ucraina
    mapGroup.append("g").selectAll("path").data(ukrGeo.features).join("path")
        .attr("d", pathGenerator).attr("fill", "#cfd2d6").attr("stroke", "#ffffff").attr("stroke-width", 1)
        .on("mouseover", handleMouseOver).on("mousemove", handleMouseMove).on("mouseout", handleMouseOut);

    // 4. Russia Attiva
    mapGroup.append("g").selectAll("path").data(visibleRusFeatures).join("path")
        .attr("d", pathGenerator).attr("fill", "#cfd2d6").attr("stroke", "#ffffff").attr("stroke-width", 1)
        .on("mouseover", handleMouseOver).on("mousemove", handleMouseMove).on("mouseout", handleMouseOut);

    // 5. Confine Rosso
    mapGroup.append("g").attr("clip-path", "url(#clip-russia-full-mask)").style("pointer-events", "none") 
        .selectAll("path").data(ukrGeo.features).join("path")
        .attr("d", pathGenerator).attr("fill", "none").attr("stroke", "#ff3333").attr("stroke-width", 4)
        .attr("stroke-linejoin", "round").attr("stroke-linecap", "round");

    // --- CANVAS PUNTI (MODIFICATO PER RESPONSIVE) ---
    const canvas = container.append("canvas")
        .attr("width", width)  // Risoluzione interna (pixel reali)
        .attr("height", height) // Risoluzione interna
        .style("position", "absolute")
        .style("top", 0)
        .style("left", 0)
        .style("width", "100%")  // Scalato visivamente
        .style("height", "100%") // Scalato visivamente
        .style("z-index", 2)
        .style("pointer-events", "none"); 
    
    const ctx = canvas.node().getContext("2d");

    let currentTransform = d3.zoomIdentity;
    let activeFilter = "all";
    let currentIndex = 0;
    let visiblePoints = [];
    const opacityScale = d3.scaleLinear().domain([0, 5]).range([1, 0.15]);

    function render() {
        ctx.clearRect(0, 0, width, height);
        ctx.save();
        ctx.translate(currentTransform.x, currentTransform.y);
        ctx.scale(currentTransform.k, currentTransform.k);

        const currentDate = days[currentIndex];
        const r = 4 / currentTransform.k; 
        const lineWidth = 0.5 / currentTransform.k;

        for (let i = 0; i < visiblePoints.length; i++) {
            const d = visiblePoints[i];
            const age = d3.timeDay.count(d.date, currentDate);
            ctx.globalAlpha = opacityScale(age);
            ctx.fillStyle = d.event_type === "Battles" ? "#c1272d" : "#f5a623";
            ctx.beginPath();
            ctx.arc(d.x, d.y, r, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = "white";
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        }
        ctx.restore();
    }

    function updateVisibleData() {
        const currentDate = days[currentIndex];
        const startDate = d3.timeDay.offset(currentDate, -5);
        visiblePoints = allBattlesData.filter(d => {
            const timeMatch = d.date > startDate && d.date <= currentDate;
            const typeMatch = activeFilter === "all" || d.event_type === activeFilter;
            return timeMatch && typeMatch;
        });
        d3.select("#current-date-display").text(d3.timeFormat("%d %b %Y")(currentDate));
        render();
    }


    // --- Zoom Logic ---
    const zoom = d3.zoom()
        .scaleExtent([1, 12])
        .on("zoom", (event) => {
            mapGroup.attr("transform", event.transform);
            currentTransform = event.transform;
            render(); // Ridisegna i punti
            tooltip.style("opacity", 0);
        });

    svg.call(zoom).on("dblclick.zoom", null);

    d3.select("#front-zoom-in").on("click", () => svg.transition().call(zoom.scaleBy, 1.3));
    d3.select("#front-zoom-out").on("click", () => svg.transition().call(zoom.scaleBy, 0.7));
    d3.select("#front-zoom-reset").on("click", () => svg.transition().call(zoom.transform, d3.zoomIdentity));


    // --- LOGICA FILTRI (QUESTA PARTE MANCAVA!) ---
    // Seleziona i bottoni "compact" dentro il container filtri
    d3.selectAll("#filter-container .btn-compact").on("click", function() {
        // 1. Gestione classi CSS (Visuale)
        d3.selectAll("#filter-container .btn-compact").classed("active", false); // Togli active da tutti
        d3.select(this).classed("active", true); // Metti active su quello cliccato

        // 2. Aggiornamento Logica
        activeFilter = d3.select(this).attr("data-type"); // Leggi il tipo dal HTML
        
        // 3. Render
        updateVisibleData(); // Aggiorna la mappa
    });


    // --- TIMELINE PLAYER LOGIC ---
    const slider = d3.select("#time-slider").attr("max", days.length - 1);
    
    // Gestione trascinamento manuale slider
    slider.on("input", function() {
        currentIndex = +this.value;
        updateVisibleData();
    });

    let timer;
    let isPlaying = false;
    
    // Selezioniamo gli elementi una volta sola per pulizia
    const playButton = d3.select("#play-button");
    const playText = d3.select("#play-text"); 

    playButton.on("click", function() {
        if (isPlaying) {
            // --- LOGICA PAUSA ---
            clearInterval(timer);
            playText.text("Play");
            isPlaying = false;
        } else {
            // --- LOGICA PLAY ---

            // Se siamo arrivati in fondo e premiamo Play, ripartiamo dall'inizio.
            if (currentIndex >= days.length - 1) {
                currentIndex = 0;
                slider.property("value", currentIndex);
                updateVisibleData();
            }

            // Cambia testo in Pause
            playText.text("Pause");
            isPlaying = true;

            timer = setInterval(() => {
                // 1. Incrementa indice
                currentIndex++;

                // 2. Aggiorna Grafica
                slider.property("value", currentIndex);
                updateVisibleData();

                // 3. Controllo Fine Corsa
                if (currentIndex >= days.length - 1) {
                    // STOP! Siamo arrivati alla fine
                    clearInterval(timer);
                    isPlaying = false;
                    playText.text("Play"); // Rimette il tasto su Play per eventuale riavvio
                }
                
            }, 70); // Velocità animazione
        }
    });

    // Render iniziale
    updateVisibleData();

    // -- How to read the chart --
    const mapHelpContent = {
        title: "How to read the Map",
        steps: [
            "<strong>Colors:</strong> Darker red indicates a higher number of conflict events.",
            "<strong>Interaction:</strong> Hover over any country to see detailed statistics.",
            "<strong>Zoom:</strong> Click on a country to zoom in and explore regional data."
        ]
    };

    // Chiamo utils.js con i NUOVI parametri
    if (typeof createChartHelp === "function") {
        createChartHelp("#front-help-container", "#front-map-wrapper", mapHelpContent);
    } else {
        console.warn("createChartHelp non trovata.");
    }

}).catch(err => {
    console.error("Errore Front Map:", err);
});