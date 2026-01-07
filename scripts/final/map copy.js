
// File: geoChoropleth.js 
/*
const GENERAL_GEOJSON_PATH = "../../data/final/geojson/europe3.geojson";
const COUNTRIES_EVENTS_PATH = "../../data/final/df_country_summary.json";
const ADMIN_EVENTS_PATH = "../../data/final/df_admin_summary.json";

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
    let isZoomed = false;
    const geoCache = new Map();

    // Helpers
    function getGeoName(d) {
        return d.properties.NAME;
    }

    function getGeoISO(d) {
        return d.properties.ISO3;
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
                console.log("Clicked ISO:", isoCode);
                const name = getGeoName(d);
                
                if (!isZoomed && isoCode) {
                    loadDetail(isoCode, name);
                }
            });
    }

    // Function to load country detail
    function loadDetail(iso, countryName) {
        d3.select(".map-filters").style("visibility", "hidden");
        const upperISO = iso.toUpperCase();
        const path = `../../data/final/geojson/countriesv2/${upperISO}.geojson`;

        if (geoCache.has(upperISO)) {
            renderCountryDetail(geoCache.get(upperISO), countryName);
        } else {
            d3.json(path).then(detailGeojson => {
                geoCache.set(upperISO, detailGeojson);
                renderCountryDetail(detailGeojson, countryName);
            }).catch(err => {
                console.error("Loading error:", path, err);
                alert("Regional data missing for: " + countryName);
                d3.select(".map-filters").style("visibility", "visible");
            });
        }
    }

    // Function to render country detail view
    function renderCountryDetail(geo, name) {
        isZoomed = true;
        overlay.style("display", "block").style("opacity", 1);
        detailGroup.selectAll("*").remove();
        detailGroup.style("display", "block").style("opacity", 1);

        const localProjection = d3.geoIdentity().reflectY(true);
        const localPath = d3.geoPath().projection(localProjection);

        const featuresToUse = geo.features; 
        const cleanGeo = { type: "FeatureCollection", features: featuresToUse };
        localProjection.fitExtent([[120, 50], [width * 0.75, height - 150]], cleanGeo);

        const selYear = yearSelect.property("value");
        const selEvent = eventSelect.property("value");

        const filteredAdmin = admin_data.filter(d => 
            d.COUNTRY === name &&
            (selYear === "All" || (getYear(d) && getYear(d).toString() === selYear)) &&
            (selEvent === "All" || d.EVENT_TYPE === selEvent)
        );

        const adminCounts = d3.rollup(filteredAdmin, v => d3.sum(v, d => getEvents(d)), d => d.ADMIN1);
        const adminMax = d3.max(Array.from(adminCounts.values())) || 1;
        const adminColor = d3.scaleSqrt().domain([0, adminMax]).range(["#fff5f0", "#99000d"]);

        detailGroup.append("text")
            .attr("x", width/2).attr("y", 40)
            .attr("text-anchor", "middle").attr("fill", "white")
            .style("font-size", "24px").text(name);

        const close = detailGroup.append("g")
            .attr("transform", `translate(${width - 60}, 40)`)
            .style("cursor", "pointer")
            .on("click", closeDetail);
        
        close.append("circle").attr("r", 15).attr("fill", "white");
        close.append("text").attr("text-anchor", "middle").attr("dy", "0.35em").text("X");

        const g = detailGroup.append("g"); 
        g.selectAll("path")
            .data(cleanGeo.features)
            .join("path")
            .attr("d", localPath)
            .attr("stroke", "#444")
            .attr("fill", d => {
                const reg = d.properties.NAME_1 || d.properties.name || d.properties.COUNTRY;
                const count = adminCounts.get(reg) || 0;
                return count > 0 ? adminColor(count) : "#ffffff";
            })
            .on("mouseover", function(event, d) {
                const reg = d.properties.NAME_1 || d.properties.name || d.properties.COUNTRY;
                const count = adminCounts.get(reg) || 0;
                d3.select(this).attr("fill", "orange").attr("stroke", "#000").attr("stroke-width", 2);
                tooltip.style("opacity", 1)
                    .html(`<strong>Region:</strong> ${reg}<br><strong>#Events:</strong> ${count}`)
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 15) + "px");
            })
            .on("mousemove", (event) => {
                tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
            })
            .on("mouseout", function(event, d) {
                const reg = d.properties.NAME_1 || d.properties.name || d.properties.COUNTRY;
                const count = adminCounts.get(reg) || 0;
                d3.select(this).attr("stroke", "#444").attr("stroke-width", 1)
                    .attr("fill", count > 0 ? adminColor(count) : "#ffffff");
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
*/

// COSTANTI E PERCORSI
const GENERAL_GEOJSON_PATH = "../../data/final/geojson/europe3.geojson";
const ACLED_CSV_PATH = "../../data/final/ACLED_grouped_events_gid.csv"; 

// Variabile globale per i dati
let globalCsvData = [];

Promise.all([
    d3.json(GENERAL_GEOJSON_PATH),
    d3.csv(ACLED_CSV_PATH)
]).then(function([geojson, csvData]) {

    // --- 1. PREPARAZIONE DATI ---
    // Convertiamo i numeri subito e puliamo le stringhe
    globalCsvData = csvData.map(d => ({
        ...d,
        EVENTS: +d.EVENTS || 0,
        YEAR: +d.YEAR,
        GID_1: d.GID_1 ? d.GID_1.trim() : null,
        ISO: d.ISO ? d.ISO.trim() : null,
        EVENT_TYPE: d.EVENT_TYPE
    }));

    // --- 2. CONFIGURAZIONE SVG ---
    const width = 1000;
    const height = 700;
    const marginTop = 50; 

    const svg = d3.select("#geo-container")
        .attr("viewBox", [0, 0, width, height])
        .style("width", "100%")
        .style("height", "auto")
        .style("background-color", "#f8f9fa") // Sfondo Grigio Chiaro
        .style("border", "1px solid #dee2e6")  // Bordo Grigio Tenue
        .style("border-radius", "8px");        // Angoli Arrotondati
    
    // Titolo
    svg.append("text")
        .attr("class", "graph-title")
        .attr("x", width / 2)
        .attr("y", marginTop / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .text("Disorders in Europe");

    // --- 3. PROIEZIONE ---
    // Manteniamo geoIdentity + reflectY come richiesto dal tuo GeoJSON specifico
    const projection = d3.geoIdentity().reflectY(true);
    const pathGenerator = d3.geoPath().projection(projection);
    
    const mapGroup = svg.append("g").attr("transform", `translate(0, ${marginTop})`);
    
    // Overlay scuro (per quando si apre il dettaglio)
    const overlay = svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "rgba(45, 45, 45, 0.9)")
        .style("display", "none")
        .style("pointer-events", "all")
        .on("click", closeDetail);

    const detailGroup = svg.append("g").style("display", "none");

    // Tooltip
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

    // Scale colori
    const colorScaleCountry = d3.scaleSqrt().range(["#fee5d9", "#C8102E"]);
    const colorScaleRegion = d3.scaleSqrt().range(["#fff5f0", "#99000d"]);

    // --- 4. POPOLAZIONE SELETTORI ---
    const uniqueYears = [...new Set(globalCsvData.map(d => d.YEAR))].filter(d => d).sort(d3.descending);
    const uniqueEvents = [...new Set(globalCsvData.map(d => d.EVENT_TYPE))].filter(d => d).sort();

    const yearSelect = d3.select("#select-year");
    yearSelect.selectAll("option.dyn-year")
        .data(uniqueYears)
        .join("option")
        .attr("class", "dyn-year")
        .attr("value", d => d)
        .text(d => d);

    const eventSelect = d3.select("#select-event");
    eventSelect.selectAll("option.dyn-event")
        .data(uniqueEvents)
        .join("option")
        .attr("class", "dyn-event")
        .attr("value", d => d)
        .text(d => d);

    // Stato Zoom
    let isZoomed = false;
    const geoCache = new Map();

    // --- HELPER CRUCIALE PER LEGGERE L'ISO ---
    // Uniforma la lettura delle proprietà del GeoJSON
    function getGeoISO(d) {
        return d.properties.ISO3 || d.properties.ISO_A3 || d.properties.GID_0 || d.properties.ISO || d.properties.ADM0_A3;
    }

    // --- 5. FUNZIONE UPDATE MAPPA PRINCIPALE ---
    function updateVisualization() {
        const selYear = yearSelect.property("value");
        const selEvent = eventSelect.property("value");

        // 1. Filtra il CSV globale
        const filtered = globalCsvData.filter(d => {
            return (selYear === "All" || d.YEAR === +selYear) &&
                   (selEvent === "All" || d.EVENT_TYPE === selEvent);
        });

        // 2. Aggrega per PAESE (usando colonna ISO del CSV)
        const countsMap = d3.rollup(filtered, v => d3.sum(v, d => d.EVENTS), d => d.ISO);

        // Aggiorna dominio scala colori
        colorScaleCountry.domain([0, d3.max(Array.from(countsMap.values())) || 1]);

        // Setup Proiezione Europa (Coordinate fisse)
        const europeFocus = {
            type: "FeatureCollection",
            features: [{
                type: "Feature",
                geometry: {
                    type: "Polygon",
                    coordinates: [[[-25, 30], [70, 30], [70, 75], [-25, 75], [-25, 30]]]
                }
            }]
        };
        projection.fitExtent([[10, 10], [width * 0.9, height - 100]], europeFocus);

        // 3. Disegna/Aggiorna i Paesi
        // Usiamo .join in modo esplicito per applicare il FILL subito, senza transizioni
        mapGroup.selectAll("path")
            .data(geojson.features)
            .join(
                enter => enter.append("path")
                    .attr("d", pathGenerator)
                    .attr("stroke", "#fff")
                    .attr("stroke-width", 0.5)
                    .style("cursor", "pointer")
                    .attr("fill", d => {
                        const iso = getGeoISO(d);
                        const count = countsMap.get(iso) || 0;
                        return count > 0 ? colorScaleCountry(count) : "#eee";
                    }),
                update => update
                    .attr("d", pathGenerator)
                    .attr("fill", d => {
                        const iso = getGeoISO(d);
                        const count = countsMap.get(iso) || 0;
                        return count > 0 ? colorScaleCountry(count) : "#eee";
                    })
            )
            // Eventi Mouse
            .on("mouseover", function(event, d) {
                const iso = getGeoISO(d);
                const name = d.properties.NAME || d.properties.name || d.properties.admin; 
                const count = countsMap.get(iso) || 0;
                
                d3.select(this)
                    .raise() // Porta in primo piano
                    .attr("fill", "orange")
                    .attr("stroke", "#000")
                    .attr("stroke-width", 1);
                
                tooltip.style("opacity", 1)
                    .html(`<strong>${name}</strong><br>Events: ${count}`)
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 15) + "px");
            })
            .on("mousemove", (event) => {
                tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
            })
            .on("mouseout", function(event, d) {
                const iso = getGeoISO(d);
                const count = countsMap.get(iso) || 0;
                
                d3.select(this)
                    .attr("stroke", "#fff")
                    .attr("stroke-width", 0.5)
                    .attr("fill", count > 0 ? colorScaleCountry(count) : "#eee");
                
                tooltip.style("opacity", 0);
            })
            .on("click", (event, d) => {
                const iso = getGeoISO(d);
                const name = d.properties.NAME || d.properties.name;
                
                if (!isZoomed && iso) {
                    loadDetail(iso, name);
                } else {
                    console.log("ISO mancante o zoom attivo:", name);
                }
            });
    }

    // --- 6. CARICAMENTO DETTAGLIO PAESE ---
    function loadDetail(iso, countryName) {
        d3.select(".map-filters").style("visibility", "hidden");
        const upperISO = iso.toUpperCase();
        const path = `../../data/final/geojson/countriesv2/${upperISO}.geojson`;

        if (geoCache.has(upperISO)) {
            renderCountryDetail(geoCache.get(upperISO), countryName, upperISO);
        } else {
            d3.json(path).then(detailGeojson => {
                geoCache.set(upperISO, detailGeojson);
                renderCountryDetail(detailGeojson, countryName, upperISO);
            }).catch(err => {
                console.error("Errore caricamento regione:", path, err);
                alert("Dati regionali non disponibili per: " + countryName);
                d3.select(".map-filters").style("visibility", "visible");
            });
        }
    }

    // --- 7. RENDER DETTAGLIO ---
    function renderCountryDetail(geo, name, isoCode) {
        isZoomed = true;
        overlay.style("display", "block").style("opacity", 1);
        detailGroup.selectAll("*").remove();
        detailGroup.style("display", "block").style("opacity", 1);

        // Proiezione locale per il dettaglio
        const localProjection = d3.geoIdentity().reflectY(true);
        const localPath = d3.geoPath().projection(localProjection);

        const featuresToUse = geo.features; 
        const cleanGeo = { type: "FeatureCollection", features: featuresToUse };
        // Fit Extent su questo specifico paese
        localProjection.fitExtent([[120, 50], [width * 0.75, height - 150]], cleanGeo);

        // 1. Filtra CSV per questo paese specifico
        const selYear = yearSelect.property("value");
        const selEvent = eventSelect.property("value");

        const filteredCountryData = globalCsvData.filter(d => 
            d.ISO === isoCode &&
            (selYear === "All" || d.YEAR === +selYear) &&
            (selEvent === "All" || d.EVENT_TYPE === selEvent)
        );

        // 2. Crea Mappa conteggi: GID_1 -> Totale Events
        const adminMap = new Map();
        
        filteredCountryData.forEach(row => {
            if (!row.GID_1) return; // Ignora nulli

            // Se "ISO", usa isoCode, altrimenti usa GID_1
            const key = (row.GID_1 === "ISO") ? row.ISO : row.GID_1;
            const current = adminMap.get(key) || 0;
            adminMap.set(key, current + row.EVENTS);
        });

        const adminMax = d3.max(Array.from(adminMap.values())) || 1;
        colorScaleRegion.domain([0, adminMax]);

        // Titolo Dettaglio
        detailGroup.append("text")
            .attr("x", width/2).attr("y", 40)
            .attr("text-anchor", "middle").attr("fill", "black")
            .style("font-size", "24px").style("font-weight", "bold")
            .text(name);

        // Pulsante Chiudi
        const close = detailGroup.append("g")
            .attr("transform", `translate(${width - 60}, 40)`)
            .style("cursor", "pointer")
            .on("click", closeDetail);
        
        close.append("circle").attr("r", 15).attr("fill", "#333");
        close.append("text").attr("text-anchor", "middle").attr("dy", "0.35em").attr("fill", "white").style("font-weight", "bold").text("X");

        const g = detailGroup.append("g"); 
        
        g.selectAll("path")
            .data(cleanGeo.features)
            .join("path")
            .attr("d", localPath)
            .attr("stroke", "#444")
            .attr("fill", d => {
                const props = d.properties;
                let count = 0;
                // Match Regionale (GID_1)
                if (props.GID_1 && adminMap.has(props.GID_1)) {
                    count = adminMap.get(props.GID_1);
                } 
                // Match Nazionale (Fallback su GID_0 o ISO se il CSV aveva GID_1="ISO")
                else if ((props.GID_0 && adminMap.has(props.GID_0)) || (isoCode && adminMap.has(isoCode))) {
                    count = adminMap.get(props.GID_0) || adminMap.get(isoCode) || 0;
                }
                return count > 0 ? colorScaleRegion(count) : "#ffffff";
            })
            .on("mouseover", function(event, d) {
                const props = d.properties;
                let count = 0;
                if (props.GID_1 && adminMap.has(props.GID_1)) count = adminMap.get(props.GID_1);
                else if (props.GID_0 && adminMap.has(props.GID_0)) count = adminMap.get(props.GID_0);
                else if (adminMap.has(isoCode)) count = adminMap.get(isoCode);

                const regionName = props.NAME_1 || props.name || props.COUNTRY || name;

                d3.select(this).attr("fill", "orange").attr("stroke", "#000").attr("stroke-width", 2);
                tooltip.style("opacity", 1)
                    .html(`<strong>${regionName}</strong><br>Events: ${count}`)
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 15) + "px");
            })
            .on("mousemove", (event) => {
                tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
            })
            .on("mouseout", function(event, d) {
                const props = d.properties;
                let count = 0;
                if (props.GID_1 && adminMap.has(props.GID_1)) count = adminMap.get(props.GID_1);
                else if (props.GID_0 && adminMap.has(props.GID_0)) count = adminMap.get(props.GID_0);
                else if (adminMap.has(isoCode)) count = adminMap.get(isoCode);

                d3.select(this).attr("stroke", "#444").attr("stroke-width", 1)
                    .attr("fill", count > 0 ? colorScaleRegion(count) : "#ffffff");
                tooltip.style("opacity", 0);
            });
    }

    // --- FUNZIONE CHIUSURA E RESET ---
    function closeDetail() {
        isZoomed = false;
        overlay.style("display", "none");
        detailGroup.style("display", "none");
        d3.select(".map-filters").style("visibility", "visible");
        tooltip.style("opacity", 0);
        
        // Rilanciamo l'update per assicurarci che la mappa principale sia colorata correttamente
        updateVisualization(); 
    }

    // Listener Filtri
    yearSelect.on("change", updateVisualization);
    eventSelect.on("change", updateVisualization);
    
    // Avvio iniziale
    updateVisualization();

    // BOTTONE HELP (Opzionale)
    if (typeof setupHelpButton === "function") {
         setupHelpButton(svg, width, height, {
            x: 30,
            y: height-30,
            title: "Disorders in Europe",
            instructions: [
                "1. Dark intensity means more events.",
                "2. Click on a country to see regional details.",
                "3. Use filters to select Year and Event Type.",
                "4. Click 'X' to return to the full map."
            ]
        });
    }

}).catch(err => console.error("Errore Caricamento:", err));