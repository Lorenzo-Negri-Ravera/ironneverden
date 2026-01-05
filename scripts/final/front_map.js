// File: front_map.js

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