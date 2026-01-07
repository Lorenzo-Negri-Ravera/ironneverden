// File: geoChoropleth.js 

const GENERAL_GEOJSON_PATH = "../../data/final/geojson/europe3.geojson";
const COUNTRIES_EVENTS_PATH = "../../data/final/df_country_summary_v2.json";
const ADMIN_EVENTS_PATH = "../../data/final/df_admin_summary_v2.json";

Promise.all([
    d3.json(GENERAL_GEOJSON_PATH),
    d3.json(COUNTRIES_EVENTS_PATH),
    d3.json(ADMIN_EVENTS_PATH)
]).then(function([geojson, country_data, admin_data]) {

    // Dimensions and margins
    const width = 1000;
    const height = 700;
    const marginTop = 50; 

    // Build SVG container
    const svg = d3.select("#geo-container")
        .attr("viewBox", [0, 0, width, height])
        .style("width", "100%")
        .style("height", "auto")
        // --- MODIFICA QUI: STILE UNIFORMATO AGLI ALTRI GRAFICI ---
        .style("background-color", "#f8f9fa") // Sfondo Grigio Chiaro
        .style("border", "1px solid #dee2e6")  // Bordo Grigio Tenue
        .style("border-radius", "8px");        // Angoli Arrotondati
    
    // Title
    svg.append("text")
        .attr("class", "graph-title")
        .attr("x", width / 2)
        .attr("y", marginTop / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .text("Disorders in Europe");

    // --- FIX PROIEZIONE ---
    const projection = d3.geoIdentity().reflectY(true);
    const pathGenerator = d3.geoPath().projection(projection);
    
    const mapGroup = svg.append("g").attr("transform", `translate(0, ${marginTop})`);
    
    const overlay = svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "rgba(45, 45, 45, 0.9)")
        .style("display", "none")
        .style("pointer-events", "all")
        .on("click", closeDetail);

    const detailGroup = svg.append("g").style("display", "none");

    const tooltip = d3.select("body").selectAll(".tooltip-map").data([0]).join("div")
        .attr("class", "tooltip-map")
        .style("position", "absolute")
        .style("background", "white")
        .style("padding", "10px")
        .style("border", "1px solid #333")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("z-index", "3000")
        .style("opacity", 0);

    const colorScale = d3.scaleSqrt().range(["#fee5d9", "#C8102E"]);

    // Populate year and event type selectors
    const getYear = (d) =>  d.YEAR;
    const getEvents = (d) => d.EVENTS;

    const uniqueYears = [...new Set(country_data.map(d => getYear(d)))].filter(d => d).sort(d3.descending);
    const uniqueEvents = [...new Set(country_data.map(d => d.EVENT_TYPE))].filter(d => d).sort();

    const yearSelect = d3.select("#select-year");
    yearSelect.selectAll("option.dyn-year").data(uniqueYears).join("option").attr("class", "dyn-year").attr("value", d => d).text(d => d);

    const eventSelect = d3.select("#select-event");
    eventSelect.selectAll("option.dyn-event").data(uniqueEvents).join("option").attr("class", "dyn-event").attr("value", d => d).text(d => d);

    // Variable to track zoom state
    let isZoomed = false; //!!!!!
    const geoCache = new Map();

    // Helpers
    function getGeoName(d) {
        return d.properties.NAME;
    }

    function getGeoISO(d) {
        return d.properties.ISO || d.properties.ISO3;
    }

    // Function to update the main map visualization
    function updateVisualization() {
        const selYear = yearSelect.property("value");
        const selEvent = eventSelect.property("value");

        const filtered = country_data.filter(d => {
            const y = getYear(d);
            return (selYear === "All" || (y && y.toString() === selYear)) &&
                   (selEvent === "All" || d.EVENT_TYPE === selEvent);
        });

        const countsMap = d3.rollup(filtered, v => d3.sum(v, d => getEvents(d)), d => d.COUNTRY);
        colorScale.domain([0, d3.max(Array.from(countsMap.values())) || 1]);

        // --- FIX ZOOM EUROPA ---
        const europeFocus = {
            type: "FeatureCollection",
            features: [{
                type: "Feature",
                geometry: {
                    type: "Polygon",
                    coordinates: [[
                        [-25, 30], // Sud-Ovest
                        [70, 30],  // Sud-Est
                        [70, 75],  // Nord-Est
                        [-25, 75], // Nord-Ovest
                        [-25, 30]  // Chiusura
                    ]]
                }
            }]
        };

        projection.fitExtent([[10, 10], [width * 0.9, height - 100]], europeFocus);

        const countries = mapGroup.selectAll("path")
            .data(geojson.features)
            .join("path")
            .attr("d", pathGenerator)
            .attr("stroke", "#fff")
            .attr("stroke-width", 0.5)
            .style("cursor", "pointer");

        countries.transition().duration(400)
            .attr("fill", d => {
                const name = getGeoName(d);
                const c = countsMap.get(name) || 0;
                return c > 0 ? colorScale(c) : "#eee";
            });

        countries
            .on("mouseover", function(event, d) {
                const name = getGeoName(d);
                const count = countsMap.get(name) || 0;
                d3.select(this).attr("fill", "orange").attr("stroke", "#000").attr("stroke-width", 1);
                tooltip.style("opacity", 1)
                    .html(`<strong>Country:</strong> ${name}<br><strong>#Events:</strong> ${count}`)
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 15) + "px");
            })
            .on("mousemove", (event) => {
                tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
            })
            .on("mouseout", function(event, d) {
                const name = getGeoName(d);
                const count = countsMap.get(name) || 0;
                d3.select(this).attr("stroke", "#fff").attr("stroke-width", 0.5)
                    .attr("fill", count > 0 ? colorScale(count) : "#eee");
                tooltip.style("opacity", 0);
            })
            .on("click", (event, d) => {
                const isoCode = getGeoISO(d);
                const name = getGeoName(d);
                
                if (!isZoomed && isoCode) {
                    loadDetail(isoCode, name);
                }
            });
    }

    function loadDetail(iso, countryName) {
        d3.select(".map-filters").style("visibility", "hidden");
        const upperISO = iso.toUpperCase();
        const path = `../../data/final/geojson/countriesv2/${upperISO}.geojson`;

        if (geoCache.has(upperISO)) {
            // MODIFICA: Passo anche upperISO come terzo argomento
            renderCountryDetail(geoCache.get(upperISO), countryName, upperISO);
        } else {
            d3.json(path).then(detailGeojson => {
                geoCache.set(upperISO, detailGeojson);
                // MODIFICA: Passo anche upperISO come terzo argomento
                renderCountryDetail(detailGeojson, countryName, upperISO);
            }).catch(err => {
                console.error("Loading error:", path, err);
                alert("Regional data missing for: " + countryName);
                d3.select(".map-filters").style("visibility", "visible");
            });
        }
    }

    // Function to render country detail view
    function renderCountryDetail(geo, name, isoCode) {
        isZoomed = true;
        overlay.style("display", "block").style("opacity", 1);
        detailGroup.selectAll("*").remove();
        detailGroup.style("display", "block").style("opacity", 1);

        const localProjection = d3.geoIdentity().reflectY(true);
        const localPath = d3.geoPath().projection(localProjection);

        const featuresToUse = geo.features; 
        const cleanGeo = { type: "FeatureCollection", features: featuresToUse };
        // Zoom automatico sulla geometria locale
        localProjection.fitExtent([[120, 50], [width * 0.75, height - 150]], cleanGeo);

        const selYear = yearSelect.property("value");
        const selEvent = eventSelect.property("value");

        // --- 1. FILTRAGGIO DATI ---
        const filteredAdmin = admin_data.filter(d => 
            d.COUNTRY === name &&
            // Logica richiesta: ignora se GID_1 è nullo
            d.GID_1 != null && 
            (selYear === "All" || (getYear(d) && getYear(d).toString() === selYear)) &&
            (selEvent === "All" || d.EVENT_TYPE === selEvent)
        );

        // --- 2. LOGICA DI AGGREGAZIONE (Join GID_1 + Eccezione ISO) ---
        let nationalBaseCount = 0;
        const regionCounts = new Map();

        filteredAdmin.forEach(d => {
            const val = getEvents(d);
            // Se GID_1 è "ISO" o uguale al codice ISO del paese -> Valore Nazionale
            if (d.GID_1 === "ISO" || d.GID_1 === isoCode) {
                nationalBaseCount += val;
            } else {
                // Altrimenti accumula sulla regione specifica (GID_1)
                const current = regionCounts.get(d.GID_1) || 0;
                regionCounts.set(d.GID_1, current + val);
            }
        });

        // --- 3. CALCOLO MAX PER SCALA COLORI ---
        // Il massimo è il valore regionale più alto + l'eventuale base nazionale
        const maxRegional = d3.max(Array.from(regionCounts.values())) || 0;
        const totalMax = maxRegional + nationalBaseCount;
        
        // Evitiamo dominio [0,0] se non ci sono dati
        const adminColor = d3.scaleSqrt()
            .domain([0, totalMax || 1]) 
            .range(["#fff5f0", "#99000d"]);

        // --- TITOLO E INTERFACCIA ---
        detailGroup.append("text")
            .attr("x", width/2).attr("y", 40)
            .attr("text-anchor", "middle").attr("fill", "black") // Corretto a nero per visibilità su sfondo chiaro
            .style("font-size", "24px").text(name);

        const close = detailGroup.append("g")
            .attr("transform", `translate(${width - 60}, 40)`)
            .style("cursor", "pointer")
            .on("click", closeDetail);
        
        close.append("circle").attr("r", 15).attr("fill", "#333");
        close.append("text").attr("text-anchor", "middle").attr("dy", "0.35em").attr("fill", "white").text("X");

        // --- 4. DISEGNO REGIONI ---
        const g = detailGroup.append("g"); 
        g.selectAll("path")
            .data(cleanGeo.features)
            .join("path")
            .attr("d", localPath)
            .attr("stroke", "#444")
            .attr("fill", d => {
                // Join stretto su GID_1 del GeoJSON
                const regionGID = d.properties.GID_1; 
                
                // Valore totale = (Dato specifico regione) + (Dato "tutto il paese")
                const regionVal = regionCounts.get(regionGID) || 0;
                const totalVal = regionVal + nationalBaseCount;

                return totalVal > 0 ? adminColor(totalVal) : "#ffffff";
            })
            .on("mouseover", function(event, d) {
                const regionGID = d.properties.GID_1;
                const regionName = d.properties.NAME_1 || regionGID; // Fallback sul codice se manca il nome
                
                const regionVal = regionCounts.get(regionGID) || 0;
                const totalVal = regionVal + nationalBaseCount;

                d3.select(this).attr("fill", "orange").attr("stroke", "#000").attr("stroke-width", 2);
                
                // Tooltip dettagliato
                let htmlContent = `<strong>Region:</strong> ${regionName}<br><strong>Total Events:</strong> ${totalVal}`;
                
                // Se c'è una componente nazionale, mostriamola per chiarezza (opzionale, ma utile)
                if (nationalBaseCount > 0) {
                    htmlContent += `<br><span style='font-size:0.8em'>(Local: ${regionVal} + National: ${nationalBaseCount})</span>`;
                }

                tooltip.style("opacity", 1)
                    .html(htmlContent)
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 15) + "px");
            })
            .on("mousemove", (event) => {
                tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
            })
            .on("mouseout", function(event, d) {
                const regionGID = d.properties.GID_1;
                const regionVal = regionCounts.get(regionGID) || 0;
                const totalVal = regionVal + nationalBaseCount;

                d3.select(this).attr("stroke", "#444").attr("stroke-width", 1)
                    .attr("fill", totalVal > 0 ? adminColor(totalVal) : "#ffffff");
                tooltip.style("opacity", 0);
            });
    }

    function closeDetail() {
        isZoomed = false;
        overlay.style("display", "none");
        detailGroup.style("display", "none");
        d3.select(".map-filters").style("visibility", "visible");
        tooltip.style("opacity", 0);
        updateVisualization(); 
    }

    yearSelect.on("change", updateVisualization);
    eventSelect.on("change", updateVisualization);
    updateVisualization();

    // BOTTONE HELP
    if (typeof setupHelpButton === "function") {
         setupHelpButton(svg, width, height, {
            x: 30,
            y: height-30, // Spostato leggermente più in alto per padding
            title: "Disorders in Europe",
            instructions: [
                "1. Dark intensity means more events.",
                "2. Hover on a country to see the number of events.",
                "3. Click on a country to see details on its regions.",
                "4. Click the 'X' to return to the main map."
            ]
        });
    }

}).catch(err => console.error("Errore Caricamento:", err));
