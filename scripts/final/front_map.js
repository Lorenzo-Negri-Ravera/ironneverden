// File: front_map.js (Fixed Responsive Version + Filters Working)

// --- RUS and UKR ---
const UKR_PATH = "../../data/final/geojson/countries/UKR.json";
const RUS_PATH = "../../data/final/geojson/countries/RUS.json";
// Borders countries
const MDA_PATH = "../../data/final/geojson/countries/MDA.geojson";
const ROU_PATH = "../../data/final/geojson/countries/ROU.geojson";
const HUN_PATH = "../../data/final/geojson/countries/HUN.geojson";
const SVK_PATH = "../../data/final/geojson/countries/SVK.geojson";
const POL_PATH = "../../data/final/geojson/countries/POL.geojson";
const BLR_PATH = "../../data/final/geojson/countries/BLR.geojson";
const BGR_PATH = "../../data/final/geojson/countries/BGR.geojson";
const MKD_PATH = "../../data/final/geojson/countries/MKD.geojson";
const SRB_PATH = "../../data/final/geojson/countries/SRB.geojson";
const XKO_PATH = "../../data/final/geojson/countries/XKO.geojson";

// Data
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
    d3.json(MKD_PATH),
    d3.json(SRB_PATH),
    d3.json(XKO_PATH),
    d3.csv(FRONT_UKR_PATH),
    d3.csv(FRONT_RU_PATH)
]).then(function ([
    ukrGeo, rusGeo,
    mdaGeo, rouGeo, hunGeo, svkGeo, polGeo, blrGeo, bgrGeo, mkdGeo, srbGeo, xkoGeo,
    ukrBattlesData, ruBattlesData
]) {

    // Setup container
    const container = d3.select("#front-map-container");
    container.html("");

    // Dimensions
    const width = 1000;
    const height = 700;

    // Geo Features    
    const neighborsFeatures = [
        ...mdaGeo.features, ...rouGeo.features, ...hunGeo.features,
        ...svkGeo.features, ...polGeo.features, ...blrGeo.features,
        ...bgrGeo.features, ...mkdGeo.features, ...srbGeo.features, ...xkoGeo.features
    ];

    // Western Russia IDs to show
    const westernRussiaIds = [
        "RUORL", "RUBEL", "RUKRS", "RUBRY", "RUVOR", "RUROS", "RUVGG", "RUTAM",
        "RULIP", "RUMOS", "RUMOW", "RUKLU", "RUTUL", "RURYA", "RUAST", "RUKL",
        "RUSTA", "RUKDA", "RUSAR", "RUPNZ", "RUDA"
    ];

    const visibleRusFeatures = rusGeo.features.filter(d => westernRussiaIds.includes(d.properties.id));
    const restOfRusFeatures = rusGeo.features.filter(d => !westernRussiaIds.includes(d.properties.id));

    const projection = d3.geoIdentity()
        .reflectY(true); // Fondamentale per non avere la mappa capovolta con dati Lat/Lon

    // --- MODIFICA QUI ---
    // Invece di [...ukrGeo.features, ...visibleRusFeatures], usiamo solo ukrGeo.features
    // Questo farà sì che lo zoom iniziale riempia lo schermo con l'Ucraina.
    const extentFeatures = { type: "FeatureCollection", features: ukrGeo.features };

    // Apply a zoom level to have some margin
    // Puoi lasciare 1.1 o ridurlo a 1.0 se la vuoi ancora più grande
    const ZOOM_LEVEL = 1.1;
    const expandedWidth = (width * 0.9) * ZOOM_LEVEL;
    const expandedHeight = (height - 30) * ZOOM_LEVEL;
    const dx = (width - expandedWidth) / 2;
    const dy = (height - expandedHeight) / 2;

    // Fit with margins
    projection.fitExtent(
        [[dx, dy], [dx + expandedWidth, dy + expandedHeight]],
        extentFeatures
    );


    // Path generator
    const pathGenerator = d3.geoPath().projection(projection);

    // Data Processing
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


    // SVG Element                          
    const svg = container.append("svg")
        .attr("viewBox", [0, 0, width, height])
        .style("z-index", 1);

    // Clip Path for Russia Mask
    const mapGroup = svg.append("g");
    const defs = mapGroup.append("defs");
    defs.append("clipPath")
        .attr("id", "clip-russia-full-mask")
        .selectAll("path")
        .data(rusGeo.features)
        .join("path")
        .attr("d", pathGenerator);

    // --- TOOLTIP MODIFICATO (SOLO QUESTO) ---
    // Usiamo il div esistente nell'HTML con id="tooltip" e classe "shared-tooltip"
    const tooltip = d3.select("#tooltip")
        .attr("class", "shared-tooltip") // Sicurezza, applico la classe standard
        .style("opacity", 0)
        .style("min-width", "auto")
        .style("width", "fit-content");

    // Tooltip Handlers
    const handleMouseOver = function (event, d) {
        d3.select(this).attr("fill-opacity", 0.8);
        const regionName = d.properties.COUNTRY || d.properties.name || d.properties.NAME || "Region";
        
        // Uso struttura standard .tooltip-header
        tooltip.style("opacity", 1)
               .style("visibility", "visible")
               .html(`<div class='tooltip-header' style='margin-bottom:0; border-bottom:none;'>${regionName}</div>`);
    };
    
    const handleMouseMove = function (event) {
        tooltip.style("left", (event.pageX + 15) + "px")
               .style("top", (event.pageY - 15) + "px");
    };
    
    const handleMouseOut = function () {
        d3.select(this).attr("fill-opacity", 1);
        tooltip.style("opacity", 0).style("visibility", "hidden");
    };
    // ----------------------------------------

    // --- Draw map ---

    // 1. Neighbor Countries (Sfondo)
    mapGroup.append("g").selectAll("path").data(neighborsFeatures).join("path")
        .attr("d", pathGenerator)
        .attr("fill", "#e9ecef")
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1)
        .attr("vector-effect", "non-scaling-stroke")
        .on("mouseover", handleMouseOver).on("mousemove", handleMouseMove).on("mouseout", handleMouseOut);

    // 2. Rest of Russia (Sfondo)
    mapGroup.append("g").selectAll("path").data(restOfRusFeatures).join("path")
        .attr("d", pathGenerator)
        .attr("fill", "#cfd2d6")
        .attr("fill-opacity", 1)
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 0.5)
        .attr("vector-effect", "non-scaling-stroke")
        .on("mouseover", handleMouseOver).on("mousemove", handleMouseMove).on("mouseout", handleMouseOut);

    // 3. Ukraine (Livello medio)
    mapGroup.append("g").selectAll("path").data(ukrGeo.features).join("path")
        .attr("d", pathGenerator)
        .attr("fill", "#cfd2d6")
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1)
        .attr("vector-effect", "non-scaling-stroke")
        .on("mouseover", handleMouseOver).on("mousemove", handleMouseMove).on("mouseout", handleMouseOut);

    // 4. Western Russia (Livello medio)
    mapGroup.append("g").selectAll("path").data(visibleRusFeatures).join("path")
        .attr("d", pathGenerator)
        .attr("fill", "#cfd2d6")
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1)
        .attr("vector-effect", "non-scaling-stroke")
        .on("mouseover", handleMouseOver).on("mousemove", handleMouseMove).on("mouseout", handleMouseOut);

    // 5. Russia-Ukraine Border Highlight (PRIMO PIANO)
    // Usiamo .raise() per assicurarci che sia l'ultimo elemento SVG disegnato
    const borderGroup = mapGroup.append("g")
        .attr("clip-path", "url(#clip-russia-full-mask)")
        .style("pointer-events", "none"); // Click passano attraverso

    borderGroup.selectAll("path")
        .data(ukrGeo.features)
        .join("path")
        .attr("d", pathGenerator)
        .attr("fill", "none")
        .attr("stroke", "#6a9c71")
        .attr("stroke-width", 4)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("vector-effect", "non-scaling-stroke");

    // FORZA IN PRIMO PIANO:
    borderGroup.raise();

    // Gruppo dedicato agli Highlights degli eventi
    const highlightGroup = mapGroup.append("g").attr("class", "event-highlights");

    // --- Canvas Setup for Points (Responsive)---
    const canvas = container.append("canvas")
        .attr("width", width)
        .attr("height", height)
        .style("z-index", 2)
        .style("pointer-events", "none");

    const ctx = canvas.node().getContext("2d");

    // --- Canvas Drawing Logic ---
    let currentTransform = d3.zoomIdentity;
    let activeFilter = "all";
    let currentIndex = 0;
    let visiblePoints = [];
    const opacityScale = d3.scaleLinear().domain([0, 5]).range([1, 0.15]);

    // Render function
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
            ctx.fillStyle = d.event_type === "Battles" ? "#ff6361" : "#ffa600";
            ctx.beginPath();
            ctx.arc(d.x, d.y, r, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = "white";
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        }
        ctx.restore();
    }

    // Update visible data based on current index and filter
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

    // Funzione per pulire l'highlight (usata quando si sposta lo slider manualmente o play)
    function clearHighlight() {
        highlightGroup.selectAll("*").transition().duration(300).style("opacity", 0).remove();
    }

    // Funzione per disegnare l'highlight
    function drawEventHighlight(event) {
        // Pulisci precedenti
        clearHighlight();

        if (!event.coords) return;

        // Proietta le coordinate
        const [x, y] = projection(event.coords);

        // Aggiungi il cerchio
        const circle = highlightGroup.append("circle")
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", 0) // Parte da 0 per l'animazione
            .attr("fill", "#ff0000") // Rosso
            .attr("fill-opacity", 0.3) // Semitrasparente
            .attr("stroke", "#ff0000")
            .attr("stroke-width", 2)
            .attr("pointer-events", "none"); // Importante: lascia passare il mouse sotto

        // Animazione di apparizione (pop)
        circle.transition().duration(600).ease(d3.easeElasticOut)
            .attr("r", event.radius || 25);

        // Opzionale: Aggiungi un anello che pulsa per attirare l'attenzione
        const pulse = highlightGroup.append("circle")
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", event.radius || 25)
            .attr("fill", "none")
            .attr("stroke", "#ff0000")
            .attr("stroke-width", 2)
            .style("opacity", 1);

        // Loop infinito di pulsazione
        function repeatPulse() {
            pulse.transition().duration(1500)
                .attr("r", (event.radius || 25) * 1.5)
                .style("opacity", 0)
                .on("end", function () {
                    d3.select(this).attr("r", event.radius || 25).style("opacity", 1);
                    repeatPulse();
                });
        }
        repeatPulse();
    }


    const zoom = d3.zoom()
        .scaleExtent([1, 12]) // Limita lo zoom in/out (min 1x, max 12x)
        // Definisce il recinto: [[minX, minY], [maxX, maxY]]
        // Aggiungiamo un margine di 100px per dare un po' di respiro ai bordi
        .translateExtent([
            [-100, -100],
            [width + 100, height + 100]
        ])
        .on("zoom", (event) => {
            mapGroup.attr("transform", event.transform);
            currentTransform = event.transform;
            render();
            tooltip.style("opacity", 0);
        });

    svg.call(zoom).on("dblclick.zoom", null);

    // Zoom Buttons
    d3.select("#front-zoom-in").on("click", () => svg.transition().call(zoom.scaleBy, 1.3));
    d3.select("#front-zoom-out").on("click", () => svg.transition().call(zoom.scaleBy, 0.7));
    d3.select("#front-zoom-reset").on("click", () => svg.transition().call(zoom.transform, d3.zoomIdentity));

    // --- Filter Buttons Logic ---
    d3.selectAll("#filter-container .btn-compact").on("click", function () {
        d3.selectAll("#filter-container .btn-compact").classed("active", false);
        d3.select(this).classed("active", true);
        activeFilter = d3.select(this).attr("data-type");
        updateVisibleData();
    });


    // --- Timeline Slider and Play/Pause Logic ---
    const slider = d3.select("#time-slider").attr("max", days.length - 1);
    const playButton = d3.select("#play-button");
    const playText = d3.select("#play-text");

    // Function to update state and render: overlap effect
    function updateStateAndRender() {
        updateVisibleData();
        d3.selectAll('.timeline-tick').style('opacity', 1);
        d3.select(`#tick-${currentIndex}`).style('opacity', 0);
    }



    slider.on("input", function () {
        currentIndex = +this.value;
        clearHighlight(); // <--- AGGIUNGI QUESTO: Rimuovi highlights se l'utente muove il tempo
        updateStateAndRender();
    });

    let timer;
    let isPlaying = false;

    // Play/Pause Logic
    playButton.on("click", function () {
        if (isPlaying) {
            clearInterval(timer);
            playText.text("Play");
            isPlaying = false;
        } else {
            // Se siamo già alla fine e premiamo play, ricominciamo da capo
            if (currentIndex >= days.length - 1) {
                currentIndex = 0;
                slider.property("value", currentIndex);
                updateStateAndRender();
            }
            
            playText.text("Pause");
            isPlaying = true;
            
            timer = setInterval(() => {
                // MODIFICA QUI: Controlliamo se c'è ancora spazio per andare avanti
                if (currentIndex < days.length - 1) {
                    currentIndex++;

                    // Se l'utente preme play, puliamo eventuali highlights attivi
                    if (currentIndex % 5 === 0) clearHighlight(); 

                    slider.property("value", currentIndex);
                    updateStateAndRender();
                } else {
                    // SIAMO ALLA FINE: Ferma tutto
                    clearInterval(timer);
                    playText.text("Play");
                    isPlaying = false;
                }
            }, 70);
        }
    });




    // Aggiungi coords: [lon, lat] e radius (opzionale, default a 20)
    const significantEvents = [
        {
            date: "2022-02-24",
            title: "Invasione su larga scala",
            coords: [30.5234, 50.4501], // Kyiv come centro simbolico
            radius: 50 // Più grande per l'intero paese/invasione
        },
        {
            date: "2022-04-01",
            title: "Ritiro dal nord (Kyiv)",
            coords: [30.5234, 50.4501], // Kyiv
            radius: 30
        },
        {
            date: "2022-09-06",
            title: "Controffensiva Kharkiv",
            coords: [36.2304, 49.9935], // Kharkiv
            radius: 30
        },
        {
            date: "2022-11-11",
            title: "Liberazione Kherson",
            coords: [32.6169, 46.6354], // Kherson
            radius: 25
        },
        {
            date: "2023-05-20",
            title: "Presa di Bakhmut",
            coords: [38.0025, 48.5947], // Bakhmut
            radius: 15 // Più piccola, battaglia localizzata
        }
    ];

    const markersContainer = document.getElementById('timeline-markers');
    if (markersContainer) markersContainer.innerHTML = "";

    const mapStartDate = days[0];
    const mapEndDate = days[days.length - 1];
    const totalTime = mapEndDate - mapStartDate;

    significantEvents.forEach(event => {
        const eventDate = parseDate(event.date);
        if (eventDate < mapStartDate || eventDate > mapEndDate) return;

        // Compute position on timeline
        const exactIndex = d3.timeDay.count(mapStartDate, eventDate);
        const percent = ((eventDate - mapStartDate) / totalTime) * 100;

        // Tooltip content
        const readableDate = d3.timeFormat("%d %b %Y")(eventDate);
        const fullLabel = `${readableDate}: ${event.title}`;

        // Create tick element
        const tick = document.createElement('div');
        tick.className = 'timeline-tick';

        // Set ID for reference (important to manage visibility on update)
        tick.id = `tick-${exactIndex}`;

        tick.style.left = percent + '%';

        // Bootstrap Tooltip attributes
        tick.setAttribute('data-bs-toggle', 'tooltip');
        tick.setAttribute('data-bs-placement', 'top');
        tick.setAttribute('title', fullLabel);


        // Click event to jump to date
        tick.addEventListener('click', function (e) {
            e.stopPropagation();
            currentIndex = exactIndex;
            slider.property("value", currentIndex);

            updateStateAndRender();

            // --- NUOVA RIGA: Disegna l'highlight specifico per questo evento ---
            drawEventHighlight(event);
        });

        if (markersContainer) markersContainer.appendChild(tick);
        new bootstrap.Tooltip(tick);
    });

    // Render 
    updateStateAndRender();


    // -- How to read the chart --
    const mapHelpContent = {
        title: "How to read the chart?",
        steps: [
            "Select the interested events through the buttons.",
            "The green line in the map represents the UKR-RUS boundary.",
            "Hover to the regions to visualize the name region.",
            "Start the animation of the events on the soil through the Play button."
        ]
    };
    if (typeof createChartHelp === "function") {
        createChartHelp("#front-help-container", "#front-map-wrapper", mapHelpContent);
    } else {
        console.warn("createChartHelp non trovata.");
    }

}).catch(err => {
    console.error("Errore Front Map:", err);
});


