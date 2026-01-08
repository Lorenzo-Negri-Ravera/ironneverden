// File: front_map.js
/*
const UKR_PATH = "../../data/final/geojson/countries/UKR.json";
const RUS_PATH = "../../data/final/geojson/countries/RUS.json";
const FRONT_UKR_PATH = "../../data/final/front_UKR.csv";
const FRONT_RU_PATH = "../../data/final/front_RU.csv";

const parseDate = d3.timeParse("%Y-%m-%d");

Promise.all([
    d3.json(UKR_PATH),
    d3.json(RUS_PATH),
    d3.csv(FRONT_UKR_PATH),
    d3.csv(FRONT_RU_PATH)
]).then(function([ukrGeo, rusGeo, ukrBattlesData, ruBattlesData]) { 

    // --- 1. SETUP DIMENSIONI E PROIEZIONE ---
    const width = 1000;
    const height = 700;
    const projection = d3.geoConicConformal().parallels([44, 52]).rotate([-31, 0]);

    // --- 2. PREPARAZIONE CONFINI ---
    const westernRussiaIds = ["RUORL", "RUBEL", "RUKRS", "RUBRY", "RUVOR", "RUROS", "RUVGG", "RUTAM", "RULIP", "RUMOS", "RUMOW", "RUKL", "RUKLU", "RUTUL", "RURYA"]; 
    const rusFeatures = rusGeo.features.filter(d => westernRussiaIds.includes(d.properties.id));
    const combinedFeatures = { type: "FeatureCollection", features: [...ukrGeo.features, ...rusFeatures] };

    // Adattiamo la proiezione
    projection.fitExtent([[30, 80], [width * 0.9, height - 50]], combinedFeatures);

    // --- 3. PREPARAZIONE DATI PUNTI ---
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

    // --- 4. SETUP CONTENITORI ---
    const container = d3.select("#front-map-container");
    
    // Stile "Card" (Sfondo grigio, bordo, radius)
    container
        .style("position", "relative") // Necessario per posizionare la zoom bar assoluta
        .style("width", width + "px")
        .style("height", height + "px")
        .style("background-color", "#f8f9fa") 
        .style("border", "1px solid #dee2e6")  
        .style("border-radius", "8px")         
        .style("margin", "0 auto")
        .style("overflow", "hidden"); // Evita che mappa esca dai bordi arrotondati

    // A. SVG PER LA MAPPA (LIVELLO SOTTO - z-index: 1)
    const svg = container.append("svg")
        .attr("viewBox", [0, 0, width, height])
        .style("position", "absolute")
        .style("top", 0)
        .style("left", 0)
        .style("z-index", 1);

    const mapGroup = svg.append("g");
    const pathGenerator = d3.geoPath().projection(projection);

    // Colori Mappa
    mapGroup.append("g").selectAll("path").data(ukrGeo.features).join("path")
        .attr("d", pathGenerator)
        .attr("fill", "#e9ecef")       
        .attr("stroke", "#ffffff")     
        .attr("stroke-width", 1.5);    

    mapGroup.append("g").selectAll("path").data(rusFeatures).join("path")
        .attr("d", pathGenerator)
        .attr("fill", "#e9ecef")       
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1.5);

    // B. CANVAS PER I PUNTI (LIVELLO SOPRA - z-index: 2)
    const canvas = container.append("canvas")
        .attr("width", width)
        .attr("height", height)
        .style("position", "absolute")
        .style("top", 0)
        .style("left", 0)
        .style("z-index", 2)
        .style("pointer-events", "none"); 
    
    const ctx = canvas.node().getContext("2d");

    // --- 5. LOGICA DI RENDERING ---
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

        for (let i = 0; i < visiblePoints.length; i++) {
            const d = visiblePoints[i];
            const age = d3.timeDay.count(d.date, currentDate);
            
            ctx.globalAlpha = opacityScale(age);
            ctx.fillStyle = d.event_type === "Battles" ? "#c1272d" : "#f5a623";
            
            ctx.beginPath();
            ctx.arc(d.x, d.y, r, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = "white";
            ctx.lineWidth = 0.2 / currentTransform.k;
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

    // --- 6. INTERAZIONI E ZOOM ---
    const zoom = d3.zoom()
        .scaleExtent([1, 25])
        .on("zoom", (event) => {
            currentTransform = event.transform;
            mapGroup.attr("transform", currentTransform);
            render();
        });
    svg.call(zoom);

    // --- MODIFICA: BARRA ZOOM ---
    // Rimuoviamo eventuali barre precedenti
    container.selectAll(".zoom-bar").remove();

    // Creiamo la barra DENTRO al container (che ha position: relative)
    // Usiamo le stesse classi CSS 'zoom-bar' e 'zoom-btn' della Spike Map
    const zoomBar = container.append("div")
        .attr("class", "zoom-bar")
        .style("position", "absolute")
        .style("top", "20px")   // Posizione in alto a destra
        .style("right", "20px")
        .style("z-index", "10") // Assicura che stia sopra al canvas (che è z-index: 2)
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("gap", "5px");

    zoomBar.append("button")
        .attr("class", "zoom-btn")
        .text("+")
        .on("click", () => { svg.transition().duration(500).call(zoom.scaleBy, 1.3); });
    
    zoomBar.append("button")
        .attr("class", "zoom-btn")
        .text("−")
        .on("click", () => { svg.transition().duration(500).call(zoom.scaleBy, 0.7); });
    
    zoomBar.append("button")
        .attr("class", "zoom-btn")
        .style("font-size", "14px")
        .text("Rst")
        .on("click", () => { svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity); });


    // Bottoni Filtro
    d3.selectAll(".filter-btn").on("click", function() {
        d3.selectAll(".filter-btn").classed("active", false);
        d3.select(this).classed("active", true);
        activeFilter = d3.select(this).attr("data-type");
        updateVisibleData();
    });

    const slider = d3.select("#time-slider").attr("max", days.length - 1);
    slider.on("input", function() {
        currentIndex = +this.value;
        updateVisibleData();
    });

    let timer;
    let isPlaying = false;
    d3.select("#play-button").on("click", function() {
        if (isPlaying) {
            clearInterval(timer);
            d3.select(this).text("Play");
        } else {
            timer = setInterval(() => {
                currentIndex++;
                if (currentIndex >= days.length) currentIndex = 0;
                slider.property("value", currentIndex);
                updateVisibleData();
            }, 70);
            d3.select(this).text("Pause");
        }
        isPlaying = !isPlaying;
    });

    updateVisibleData();

    // --- BOTTONE AIUTO ---
    if (typeof setupHelpButton === "function") {
        setupHelpButton(svg, width, height, {
            x: 30, // Posizione X (Basso Sinistra)
            y: height - 30, // Posizione Y (Basso Sinistra)
            title: "How to read the Front Line Map",
            instructions: [
                "1. Use the Time Slider or Play button to navigate through time.",
                "2. Red dots indicate Battles, Yellow dots indicate Explosions.",
                "3. Use the Zoom buttons on the top-right.",
                "4. Filter events using the buttons above the map."
            ]
        });
    }

}).catch(err => console.error(err));
*/

// File: front_map.js
/*
const UKR_PATH = "../../data/final/geojson/countries/UKR.json";
const RUS_PATH = "../../data/final/geojson/countries/RUS.json";
const FRONT_UKR_PATH = "../../data/final/front_UKR.csv";
const FRONT_RU_PATH = "../../data/final/front_RU.csv";

const parseDate = d3.timeParse("%Y-%m-%d");

Promise.all([
    d3.json(UKR_PATH),
    d3.json(RUS_PATH),
    d3.csv(FRONT_UKR_PATH),
    d3.csv(FRONT_RU_PATH)
]).then(function([ukrGeo, rusGeo, ukrBattlesData, ruBattlesData]) { 

    // --- 1. SETUP DIMENSIONI ---
    const width = 1000;
    const height = 700;
    
    // --- 2. PREPARAZIONE DATI GEOGRAFICI ---

    // A. Rimuoviamo Kaliningrad (ID: RUKL)
    rusGeo.features = rusGeo.features.filter(d => d.properties.id !== "RUKGD");
    
    // B. Liste per visualizzazione
    const westernRussiaIds = ["RUORL", "RUBEL", "RUKRS", "RUBRY", "RUVOR", "RUROS", "RUVGG", "RUTAM", "RULIP", "RUMOS", "RUMOW", "RUKLU", "RUTUL", "RURYA"]; 
    
    const visibleRusFeatures = rusGeo.features.filter(d => westernRussiaIds.includes(d.properties.id));
    const restOfRusFeatures = rusGeo.features.filter(d => !westernRussiaIds.includes(d.properties.id));
    
    // C. Setup Proiezione
    const projection = d3.geoConicConformal()
        .parallels([44, 52])
        .rotate([-31, 0]);

    // D. Calcolo Zoom e Centratura
    const extentFeatures = { type: "FeatureCollection", features: [...ukrGeo.features, ...visibleRusFeatures] };

    // --- QUI STA LA MODIFICA PER LO ZOOM ---
    // Definiamo quanto vogliamo zoomare (1.0 = normale, 1.5 = molto zoomato)
    const ZOOM_LEVEL = 1.15; 

    // Calcoliamo un box virtuale più grande dello schermo
    // Questo costringe D3 a "ingrandire" la mappa per riempirlo
    const expandedWidth = (width * 0.9) * ZOOM_LEVEL;
    const expandedHeight = (height - 30) * ZOOM_LEVEL;
    
    // Centriamo questo box virtuale al centro del nostro schermo
    const dx = (width - expandedWidth) / 2;
    const dy = (height - expandedHeight) / 2;

    // Applichiamo il fitExtent su questo box calcolato
    projection.fitExtent(
        [[dx, dy], [dx + expandedWidth, dy + expandedHeight]], 
        extentFeatures
    );
    
    // Offset manuale (per spostare la mappa leggermente a destra/su come piace a te)
    // Nota: con lo zoom aumentato, ho ridotto leggermente lo spostamento per non tagliarla
    const currentTranslate = projection.translate();
    projection.translate([
        currentTranslate[0] + 5, 
        currentTranslate[1] - 60 
    ]);

    const pathGenerator = d3.geoPath().projection(projection);

    // --- 3. PREPARAZIONE DATI PUNTI ---
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

    // --- 4. SETUP CONTENITORI ---
    const container = d3.select("#front-map-container");
    container.html(""); 
    
    container
        .style("position", "relative") 
        .style("width", width + "px")
        .style("height", height + "px")
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
        .style("z-index", 1);

    const mapGroup = svg.append("g");

    // --- 5. MASCHERA PER IL CONFINE ---
    const defs = mapGroup.append("defs");
    
    defs.append("clipPath")
        .attr("id", "clip-russia-full-mask")
        .selectAll("path")
        .data(rusGeo.features) 
        .join("path")
        .attr("d", pathGenerator);

    // Tooltip
    const tooltip = d3.select("body").selectAll(".tooltip-geo").data([0]).join("div")
        .attr("class", "tooltip-geo")
        .style("position", "absolute")
        .style("background", "rgba(255, 255, 255, 0.95)")
        .style("padding", "6px 10px")
        .style("border", "1px solid #999")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("font-size", "12px")
        .style("font-family", "sans-serif")
        .style("opacity", 0)
        .style("z-index", 9999);

    const handleMouseOver = function(event, d) {
        d3.select(this).attr("fill-opacity", 0.8);
        const regionName = d.properties.name || d.properties.NAME || "Region";
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

    // 1. RUSSIA "SFUMATA" (Il resto del paese) - SENZA KALININGRAD
    mapGroup.append("g")
        .selectAll("path")
        .data(restOfRusFeatures)
        .join("path")
        .attr("d", pathGenerator)
        .attr("fill", "#cfd2d6")      
        .attr("fill-opacity", 0.4)    
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 0.5);   

    // 2. UCRAINA (Sfondo Base)
    mapGroup.append("g")
        .selectAll("path")
        .data(ukrGeo.features)
        .join("path")
        .attr("d", pathGenerator)
        .attr("fill", "#e9ecef")
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1)
        .on("mouseover", handleMouseOver)
        .on("mousemove", handleMouseMove)
        .on("mouseout", handleMouseOut);

    // 3. RUSSIA "ATTIVA" (Occidentale)
    mapGroup.append("g")
        .selectAll("path")
        .data(visibleRusFeatures)
        .join("path")
        .attr("d", pathGenerator)
        .attr("fill", "#cfd2d6")      
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1)
        .on("mouseover", handleMouseOver)
        .on("mousemove", handleMouseMove)
        .on("mouseout", handleMouseOut);

    // 4. IL CONFINE ROSSO (Completo)
    mapGroup.append("g")
        .attr("clip-path", "url(#clip-russia-full-mask)") 
        .style("pointer-events", "none") 
        .selectAll("path")
        .data(ukrGeo.features) 
        .join("path")
        .attr("d", pathGenerator)
        .attr("fill", "none") 
        .attr("stroke", "#ff3333") 
        .attr("stroke-width", 4)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round");

    // --- CANVAS PUNTI ---
    const canvas = container.append("canvas")
        .attr("width", width)
        .attr("height", height)
        .style("position", "absolute")
        .style("top", 0)
        .style("left", 0)
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

    const zoom = d3.zoom()
        .scaleExtent([1, 25])
        .on("zoom", (event) => {
            currentTransform = event.transform;
            mapGroup.attr("transform", currentTransform);
            render();
        });
    svg.call(zoom);

    // Zoom Controls
    const zoomBar = container.append("div")
        .style("position", "absolute").style("top", "20px").style("right", "20px")
        .style("display", "flex").style("flex-direction", "column").style("gap", "5px").style("z-index", 10);

    const btnStyle = "width:30px;height:30px;background:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;box-shadow:0 2px 4px rgba(0,0,0,0.2);";
    zoomBar.append("button").attr("style", btnStyle).text("+").on("click", () => svg.transition().call(zoom.scaleBy, 1.3));
    zoomBar.append("button").attr("style", btnStyle).text("−").on("click", () => svg.transition().call(zoom.scaleBy, 0.7));
    zoomBar.append("button").attr("style", btnStyle).text("R").on("click", () => svg.transition().call(zoom.transform, d3.zoomIdentity));

    // Slider
    const slider = d3.select("#time-slider").attr("max", days.length - 1);
    slider.on("input", function() {
        currentIndex = +this.value;
        updateVisibleData();
    });

    let timer;
    let isPlaying = false;
    d3.select("#play-button").on("click", function() {
        if (isPlaying) {
            clearInterval(timer);
            d3.select(this).text("Play");
        } else {
            timer = setInterval(() => {
                currentIndex++;
                if (currentIndex >= days.length) currentIndex = 0;
                slider.property("value", currentIndex);
                updateVisibleData();
            }, 70);
            d3.select(this).text("Pause");
        }
        isPlaying = !isPlaying;
    });

    updateVisibleData();

    if (typeof setupHelpButton === "function") {
        setupHelpButton(svg, width, height, {
            x: 30, y: height - 30, title: "Mappa del Fronte",
            instructions: ["Linea ROSSA = Confine con la Russia", "Punti Rossi = Battaglie", "Punti Gialli = Esplosioni"]
        });
    }

}).catch(err => console.error("Errore Front Map:", err));
*/

// File: front_map.js

// --- PERCORSI PAESI ---
const UKR_PATH = "../../data/final/geojson/countries/UKR.json";
const RUS_PATH = "../../data/final/geojson/countries/RUS.json";
// Nuovi Paesi Confinanti
const MDA_PATH = "../../data/final/geojson/countries/MDA.geojson"; // Moldavia
const ROU_PATH = "../../data/final/geojson/countries/ROU.geojson"; // Romania
const HUN_PATH = "../../data/final/geojson/countries/HUN.geojson"; // Ungheria
const SVK_PATH = "../../data/final/geojson/countries/SVK.geojson"; // Slovacchia
const POL_PATH = "../../data/final/geojson/countries/POL.geojson"; // Polonia
const BLR_PATH = "../../data/final/geojson/countries/BLR.geojson"; // Bielorussia
const BGR_PATH = "../../data/final/geojson/countries/BGR.geojson"; // Bulgaria

const FRONT_UKR_PATH = "../../data/final/front_UKR.csv";
const FRONT_RU_PATH = "../../data/final/front_RU.csv";

const parseDate = d3.timeParse("%Y-%m-%d");

Promise.all([
    d3.json(UKR_PATH),
    d3.json(RUS_PATH),
    // Carichiamo i vicini
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

    // --- 1. SETUP DIMENSIONI ---
    const width = 1000;
    const height = 700;
    
    // --- 2. PREPARAZIONE DATI GEOGRAFICI ---
    
    // B. Uniamo tutti i vicini in un'unica lista per comodità di disegno
    const neighborsFeatures = [
        ...mdaGeo.features,
        ...rouGeo.features,
        ...hunGeo.features,
        ...svkGeo.features,
        ...polGeo.features,
        ...blrGeo.features,
        ...bgrGeo.features
    ];

    // C. Russia Split (Occidentale vs Resto)
    // HO AGGIUNTO QUI I CODICI MANCANTI PER COPRIRE IL BUCO A DESTRA/SUD
    const westernRussiaIds = [
        "RUORL", "RUBEL", "RUKRS", "RUBRY", "RUVOR", "RUROS", "RUVGG", "RUTAM", "RULIP", "RUMOS", "RUMOW", "RUKLU", "RUTUL", "RURYA",
        "RUAST", // Astrakhan
        "RUKL", // Calmucchia (Kalmykia) - Copre il buco tra Rostov, Volgograd e Astrakhan
        "RUSTA", // Stavropol
        "RUKDA", // Krasnodar
        "RUSAR", // Saratov
        "RUPNZ", // Penza
        "RUDA"
    ]; 
    
    const visibleRusFeatures = rusGeo.features.filter(d => westernRussiaIds.includes(d.properties.id));
    const restOfRusFeatures = rusGeo.features.filter(d => !westernRussiaIds.includes(d.properties.id));
    
    // D. Proiezione
    const projection = d3.geoConicConformal()
        .parallels([44, 52])
        .rotate([-31, 0]);

    // E. Calcolo Zoom (Ora include anche Astrakhan, Calmucchia, ecc. nel calcolo!)
    const extentFeatures = { type: "FeatureCollection", features: [...ukrGeo.features, ...visibleRusFeatures] };

    const ZOOM_LEVEL = 1.25; // +25% Zoom

    const expandedWidth = (width * 0.9) * ZOOM_LEVEL;
    const expandedHeight = (height - 30) * ZOOM_LEVEL;
    const dx = (width - expandedWidth) / 2;
    const dy = (height - expandedHeight) / 2;

    projection.fitExtent(
        [[dx, dy], [dx + expandedWidth, dy + expandedHeight]], 
        extentFeatures
    );
    
    // Offset manuale
    const currentTranslate = projection.translate();
    projection.translate([
        currentTranslate[0] + 55,  
        currentTranslate[1] - 80 
    ]);

    const pathGenerator = d3.geoPath().projection(projection);

    // --- 3. PREPARAZIONE DATI PUNTI ---
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

    // --- 4. SETUP CONTENITORI ---
    const container = d3.select("#front-map-container");
    container.html(""); 
    
    container
        .style("position", "relative") 
        .style("width", width + "px")
        .style("height", height + "px")
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
        .style("z-index", 1);

    const mapGroup = svg.append("g");

    // --- 5. MASCHERA PER IL CONFINE ---
    const defs = mapGroup.append("defs");
    
    defs.append("clipPath")
        .attr("id", "clip-russia-full-mask")
        .selectAll("path")
        .data(rusGeo.features) 
        .join("path")
        .attr("d", pathGenerator);

    // Tooltip
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

    // --- MODIFICA QUI: Aggiunto d.properties.COUNTRY ---
    const handleMouseOver = function(event, d) {
        d3.select(this).attr("fill-opacity", 0.8);
        // Cerca COUNTRY, poi name, poi NAME, altrimenti "Region"
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

    // 1. VICINI (Background) - GRIGIO CHIARO
    mapGroup.append("g")
        .selectAll("path")
        .data(neighborsFeatures)
        .join("path")
        .attr("d", pathGenerator)
        .attr("fill", "#e9ecef")       
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1)
        .on("mouseover", handleMouseOver)
        .on("mousemove", handleMouseMove)
        .on("mouseout", handleMouseOut);

    // 2. RUSSIA "RESTANTE" - GRIGIO SCURO
    mapGroup.append("g")
        .selectAll("path")
        .data(restOfRusFeatures)
        .join("path")
        .attr("d", pathGenerator)
        .attr("fill", "#cfd2d6")      // Grigio Scuro
        .attr("fill-opacity", 1)      // Pieno
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 0.5)
        .on("mouseover", handleMouseOver)
        .on("mousemove", handleMouseMove)
        .on("mouseout", handleMouseOut);

    // 3. UCRAINA - GRIGIO SCURO
    mapGroup.append("g")
        .selectAll("path")
        .data(ukrGeo.features)
        .join("path")
        .attr("d", pathGenerator)
        .attr("fill", "#cfd2d6")       
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1)
        .on("mouseover", handleMouseOver)
        .on("mousemove", handleMouseMove)
        .on("mouseout", handleMouseOut);

    // 4. RUSSIA "ATTIVA" (Occidentale) - GRIGIO SCURO
    mapGroup.append("g")
        .selectAll("path")
        .data(visibleRusFeatures)
        .join("path")
        .attr("d", pathGenerator)
        .attr("fill", "#cfd2d6")       
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1)
        .on("mouseover", handleMouseOver)
        .on("mousemove", handleMouseMove)
        .on("mouseout", handleMouseOut);

    // 5. IL CONFINE ROSSO
    mapGroup.append("g")
        .attr("clip-path", "url(#clip-russia-full-mask)") 
        .style("pointer-events", "none") 
        .selectAll("path")
        .data(ukrGeo.features) 
        .join("path")
        .attr("d", pathGenerator)
        .attr("fill", "none") 
        .attr("stroke", "#ff3333") 
        .attr("stroke-width", 4)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round");

    // --- CANVAS PUNTI ---
    const canvas = container.append("canvas")
        .attr("width", width)
        .attr("height", height)
        .style("position", "absolute")
        .style("top", 0)
        .style("left", 0)
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

    const zoom = d3.zoom()
        .scaleExtent([1, 25])
        .on("zoom", (event) => {
            currentTransform = event.transform;
            mapGroup.attr("transform", currentTransform);
            render();
        });
    svg.call(zoom);

    // Zoom Controls
    const zoomBar = container.append("div")
        .style("position", "absolute").style("top", "20px").style("right", "20px")
        .style("display", "flex").style("flex-direction", "column").style("gap", "5px").style("z-index", 10);

    const btnStyle = "width:30px;height:30px;background:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;box-shadow:0 2px 4px rgba(0,0,0,0.2);";
    zoomBar.append("button").attr("style", btnStyle).text("+").on("click", () => svg.transition().call(zoom.scaleBy, 1.3));
    zoomBar.append("button").attr("style", btnStyle).text("−").on("click", () => svg.transition().call(zoom.scaleBy, 0.7));
    zoomBar.append("button").attr("style", btnStyle).text("R").on("click", () => svg.transition().call(zoom.transform, d3.zoomIdentity));

    // Slider
    const slider = d3.select("#time-slider").attr("max", days.length - 1);
    slider.on("input", function() {
        currentIndex = +this.value;
        updateVisibleData();
    });

    let timer;
    let isPlaying = false;
    d3.select("#play-button").on("click", function() {
        if (isPlaying) {
            clearInterval(timer);
            d3.select(this).text("Play");
        } else {
            timer = setInterval(() => {
                currentIndex++;
                if (currentIndex >= days.length) currentIndex = 0;
                slider.property("value", currentIndex);
                updateVisibleData();
            }, 70);
            d3.select(this).text("Pause");
        }
        isPlaying = !isPlaying;
    });

    updateVisibleData();

    if (typeof setupHelpButton === "function") {
        setupHelpButton(svg, width, height, {
            x: 30, y: height - 30, title: "Mappa del Fronte",
            instructions: ["Linea ROSSA = Confine con la Russia", "Punti Rossi = Battaglie", "Punti Gialli = Esplosioni"]
        });
    }

}).catch(err => console.error("Errore Front Map:", err));