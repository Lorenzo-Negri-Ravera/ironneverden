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

    // --- 4. SETUP CONTENITORI (ORDINE INVERTITO PER LIVELLI) ---
    const container = d3.select("#front-map-container");
    container.style("position", "relative").style("width", width + "px").style("height", height + "px");

    // A. SVG PER LA MAPPA (LIVELLO SOTTO - z-index: 1)
    const svg = container.append("svg")
        .attr("viewBox", [0, 0, width, height])
        .style("position", "absolute")
        .style("top", 0)
        .style("left", 0)
        .style("z-index", 1);

    const mapGroup = svg.append("g");
    const pathGenerator = d3.geoPath().projection(projection);

    mapGroup.append("g").selectAll("path").data(ukrGeo.features).join("path")
        .attr("d", pathGenerator).attr("fill", "#d9d9d9").attr("stroke", "#ffffff").attr("stroke-width", 0.5);
    mapGroup.append("g").selectAll("path").data(rusFeatures).join("path")
        .attr("d", pathGenerator).attr("fill", "#f0f0f0").attr("stroke", "#ffffff").attr("stroke-width", 0.5);

    // B. CANVAS PER I PUNTI (LIVELLO SOPRA - z-index: 2)
    const canvas = container.append("canvas")
        .attr("width", width)
        .attr("height", height)
        .style("position", "absolute")
        .style("top", 0)
        .style("left", 0)
        .style("z-index", 2)
        .style("pointer-events", "none"); // Importante: i click passano all'SVG sotto per lo zoom
    
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

    // --- 6. INTERAZIONI (Attaccate all'SVG) ---
    const zoom = d3.zoom()
        .scaleExtent([1, 25])
        .on("zoom", (event) => {
            currentTransform = event.transform;
            mapGroup.attr("transform", currentTransform);
            render();
        });
    svg.call(zoom);

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

}).catch(err => console.error(err));