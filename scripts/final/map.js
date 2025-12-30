// File: geoChoropleth.js 

/*
const GENERAL_GEOJSON_PATH = "../../data/proj/europe.geojson";
const COUNTRIES_EVENTS_PATH = "../../data/proj/df_country_summary.json";
const ADMIN_EVENTS_PATH = "../../data/proj/df_admin_summary.json";

Promise.all([
    d3.json(GENERAL_GEOJSON_PATH),
    d3.json(COUNTRIES_EVENTS_PATH),
    d3.json(ADMIN_EVENTS_PATH)
]).then(function([geojson, raw_attacks_data]) {

    const width = 1000;
    const height = 700;
    const marginLeft = 10;
    const marginRight = 40;
    const marginBottom = 50;
    const marginTop = 50; 

    const mapWidth = width; 
    const mapHeight = height - marginTop - marginBottom;

    let isZoomed = false;
    const geoCache = new Map(); // Per velocizzare i caricamenti successivi

    // --- 1. SETUP SVG ---
    const svg = d3.select("#geo-container")
        .attr("viewBox", [0, 0, width, height])
        .style("border", "0.5px solid #999") 
        .style("background-color", "#f9f9f9");

    const projection = d3.geoMercator();
    const pathGenerator = d3.geoPath().projection(projection);

    // Gruppo per la mappa dell'Europa
    const mapGroup = svg.append("g")
        .attr("transform", `translate(${marginLeft}, ${marginTop})`);

    // Overlay oscurante
    const overlay = svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "rgba(63, 60, 60, 0.7)")
        .style("display", "none")
        .style("pointer-events", "all");

    // Pannello di dettaglio
    const detailGroup = svg.append("g")
        .attr("class", "detail-panel")
        .style("display", "none");

    // --- 2. PREPARAZIONE DATI ---
    const attackCountsByRegion = d3.rollups(
        raw_attacks_data.filter(d => d.region_id !== null), 
        v => d3.sum(v, d => d.count),                       
        d => d.region_id                                    
    );
    const countsMap = new Map(attackCountsByRegion);
    const maxCount = d3.max(attackCountsByRegion, d => d[1]) || 1;

    const colorScale = d3.scaleLinear()
        .domain([0, maxCount])
        .range(["#fcd199ff", "#C8102E"]);
    

    // --- 2. PREPARAZIONE FILTRI DINAMICI ---

    // Estraiamo i valori unici per Anni e Tipi di Evento
    const uniqueYears = [...new Set(raw_attacks_data.map(d => d.YEAR))].sort(d3.descending);
    const uniqueEvents = [...new Set(raw_attacks_data.map(d => d.EVENT_TYPE))].sort();

    // Popoliamo il menu Anni
    const yearSelect = d3.select("#select-year");
    yearSelect.selectAll("option")
        .data(["All", ...uniqueYears])
        .join("option")
        .text(d => d)
        .attr("value", d => d);

    // Popoliamo il menu Eventi
    const eventSelect = d3.select("#select-event");
    eventSelect.selectAll("option")
        .data(["All", ...uniqueEvents])
        .join("option")
        .text(d => d)
        .attr("value", d => d);

    // Funzione principale per filtrare e ricolorare la mappa
    function updateVisualization() {
        const selectedYear = yearSelect.property("value");
        const selectedEvent = eventSelect.property("value");

        // Filtriamo i dati grezzi in base alle scelte dell'utente
        const filteredData = raw_attacks_data.filter(d => {
            const matchYear = selectedYear === "All" || d.YEAR.toString() === selectedYear;
            const matchEvent = selectedEvent === "All" || d.EVENT_TYPE === selectedEvent;
            return matchYear && matchEvent && d.region_id !== null;
        });

        // Ricalcoliamo i conteggi per regione
        const attackCounts = d3.rollups(
            filteredData,
            v => d3.sum(v, d => d.count),
            d => d.region_id
        );
        const countsMap = new Map(attackCounts);
        
        // Aggiorniamo la scala dei colori (opzionale: puoi tenerla fissa o renderla dinamica)
        const currentMax = d3.max(attackCounts, d => d[1]) || 1;
        colorScale.domain([0, currentMax]);

        // Applichiamo i nuovi colori ai path della mappa EUROPA
        mapGroup.selectAll("path")
            .transition().duration(500) // Transizione fluida
            .attr("fill", d => colorScale(countsMap.get(d.properties.ISO3) || 0));

        // Aggiorniamo i tooltip (importante perché i dati sono cambiati!)
        mapGroup.selectAll("path")
            .on("mouseover", function(event, d) {
                const count = countsMap.get(d.properties.ISO3) || 0;
                d3.select(this).attr("fill", "orange");
                tooltip.style("opacity", 1)
                    .html(`<strong>${d.properties.NAME}</strong><br>Number of Events: ${count}`);
            });
    }

    // 4. LISTENER PER IL CAMBIO FILTRI
    yearSelect.on("change", updateVisualization);
    eventSelect.on("change", updateVisualization);

    // Inizializzazione: eseguiamo la funzione la prima volta
    updateVisualization();

    // --- 3. TOOLTIP ---
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background", "white")
        .style("padding", "8px")
        .style("border", "1px solid #333")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("z-index", "1000");

    // --- 4. FUNZIONE RENDER MAPPA EUROPA ---
    function renderMap(data) {
        projection.fitSize([mapWidth, mapHeight], data);

        mapGroup.selectAll("path")
            .data(data.features)
            .join("path")
            .attr("d", pathGenerator)
            .attr("fill", d => colorScale(countsMap.get(d.properties.ISO3) || 0))
            .attr("stroke", "#fff")
            .attr("stroke-width", 0.8)
            .style("cursor", "pointer")
            .on("mouseover", function(event, d) {
                d3.select(this).attr("fill", "orange");
                tooltip.style("opacity", 1)
                    .html(`<strong>${d.properties.NAME}</strong><br>Number of Events: ${countsMap.get(d.properties.ISO3) || 0}`);
            })
            .on("mousemove", (event) => {
                tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
            })
            .on("mouseout", function(event, d) {
                d3.select(this).attr("fill", colorScale(countsMap.get(d.properties.ISO3) || 0));
                tooltip.style("opacity", 0);
            })
            .on("click", function(event, d) {
                if (!isZoomed) {
                    // Passiamo sia ID che Nome per il titolo del pannello
                    loadCountryDetail(d.properties.ISO3, d.properties.NAME);
                }
            });
    }

    // --- 5. LOGICA DETTAGLIO ---
    function loadCountryDetail(countryId, countryName) {
        let path = `../../data/proj/countries/${countryId}.json`;

        if (geoCache.has(countryId)) {
            displayDetail(geoCache.get(countryId), countryName);
        } else {
            d3.json(path).then(detailGeojson => {
                geoCache.set(countryId, detailGeojson);
                displayDetail(detailGeojson, countryName);
            }).catch(err => console.error("Dati non trovati per:", countryId));
        }
    }

    function displayDetail(detailGeojson, countryName) {
        isZoomed = true;
        d3.select(".map-filters").style("display", "none"); // Hide filters when zoomed
        overlay.style("display", "block").style("opacity", 0).transition().duration(200).style("opacity", 1);
        detailGroup.selectAll("*").remove();
        detailGroup.style("display", "block").style("opacity", 1);

        // Bottone X
        const closeBtn = detailGroup.append("g")
            .attr("transform", `translate(${width - marginRight - 20}, ${marginTop + 20})`)
            .style("cursor", "pointer")
            .on("click", closeDetail);

        closeBtn.append("circle").attr("r", 18).attr("fill", "#fff").attr("stroke", "#333").attr("stroke-width", 2);
        closeBtn.append("text").attr("text-anchor", "middle").attr("dy", "0.35em").style("font-weight", "bold").text("X");

        // Titolo
        detailGroup.append("text")
            .attr("x", width / 2).attr("y", marginTop + 40)
            .attr("text-anchor", "middle").attr("fill", "white")
            .style("font-size", "26px").style("font-weight", "bold").text(countryName);

        // Mappa ridotta
        const dWidth = 600, dHeight = 400;
        projection.fitSize([dWidth, dHeight], detailGeojson);
        
        const mapContainer = detailGroup.append("g")
            .attr("transform", `translate(${(width - dWidth) / 2}, ${(height - dHeight) / 2 + 20})`);

        mapContainer.selectAll("path")
            .data(detailGeojson.features)
            .join("path")
            .attr("d", pathGenerator)
            .attr("fill", "#f0f0f0")
            .attr("stroke", "#333")
            .on("mouseover", function(event, d) {
                d3.select(this).attr("fill", "#C8102E");
                tooltip.style("opacity", 1)
                    .html(`<strong>${d.properties.NAME_1 || d.properties.name}</strong>`)
                    .style("left", (event.pageX + 15) + "px")  // Posiziona subito
                    .style("top", (event.pageY - 15) + "px");  // Posiziona subito
            })
            .on("mousemove", function(event) {
                tooltip
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 15) + "px");
        })
            .on("mouseout", function() {
                d3.select(this).attr("fill", "#f0f0f0");
                tooltip.style("opacity", 0);
            })
            .style("opacity", 0).transition().duration(200).style("opacity", 1);
    }

    function closeDetail() {
        isZoomed = false;
        d3.select(".map-filters").style("display", "flex"); // Show filters again
        overlay.transition().duration(200).style("opacity", 0).on("end", () => overlay.style("display", "none"));
        detailGroup.transition().duration(200).style("opacity", 0).on("end", () => detailGroup.style("display", "none"));
        tooltip.style("opacity", 0);
        // Ripristiniamo la proiezione originale per la mappa Europa
        projection.fitSize([mapWidth, mapHeight], geojson);
    }

    // --- 6. TITOLO PRINCIPALE ---
    svg.append("text")
        .attr("class", "graph-title")
        .attr("x", width / 2)
        .attr("y", marginTop / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .text("Geographic distribution of explosions");

    renderMap(geojson);



    // --- How to read the chart? ---
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

}).catch(err => console.error("Errore caricamento:", err));

*/

const GENERAL_GEOJSON_PATH = "../../data/final/geojson/europe.geojson";
const COUNTRIES_EVENTS_PATH = "../../data/final/df_country_summary.json";
const ADMIN_EVENTS_PATH = "../../data/final/df_admin_summary.json";

Promise.all([
    d3.json(GENERAL_GEOJSON_PATH),
    d3.json(COUNTRIES_EVENTS_PATH),
    d3.json(ADMIN_EVENTS_PATH)
]).then(function([geojson, country_data, admin_data]) {

    const width = 1000;
    const height = 700;
    const marginTop = 50; 

    const svg = d3.select("#geo-container")
        .attr("viewBox", [0, 0, width, height])
        .style("width", "100%")
        .style("height", "auto")
        .style("background-color", "#ffffff") 
        .style("border", "0.5px solid #000000");
    
    // --- 5. TITOLO PRINCIPALE ---
    svg.append("text")
        .attr("class", "graph-title")
        .attr("x", width / 2)
        .attr("y", marginTop / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .text("Disorders in Europe");

    const projection = d3.geoMercator();
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

    const getYear = (d) => d.year || d.YEAR;
    const getEvents = (d) => d.EVENTS || d.count || 0;

    const uniqueYears = [...new Set(country_data.map(d => getYear(d)))].filter(d => d).sort(d3.descending);
    const uniqueEvents = [...new Set(country_data.map(d => d.EVENT_TYPE))].filter(d => d).sort();

    const yearSelect = d3.select("#select-year");
    yearSelect.selectAll("option.dyn-year").data(uniqueYears).join("option").attr("class", "dyn-year").attr("value", d => d).text(d => d);

    const eventSelect = d3.select("#select-event");
    eventSelect.selectAll("option.dyn-event").data(uniqueEvents).join("option").attr("class", "dyn-event").attr("value", d => d).text(d => d);

    let isZoomed = false;
    const geoCache = new Map();

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

        projection.fitExtent([[100, 20], [width * 0.8, height - 100]], geojson);

        // Salviamo la selezione in una variabile per gestire correttamente eventi e transizioni
        const countries = mapGroup.selectAll("path")
            .data(geojson.features)
            .join("path")
            .attr("d", pathGenerator)
            .attr("stroke", "#fff")
            .attr("stroke-width", 0.5)
            .style("cursor", "pointer");

        // Applichiamo la transizione separatamente
        countries.transition().duration(400)
            .attr("fill", d => {
                const c = countsMap.get(d.properties.NAME) || 0;
                return c > 0 ? colorScale(c) : "#eee";
            });

        // Colleghiamo gli eventi alla selezione (NON alla transizione)
        countries
            .on("mouseover", function(event, d) {
                const count = countsMap.get(d.properties.NAME) || 0;
                d3.select(this).attr("fill", "orange").attr("stroke", "#000").attr("stroke-width", 1);
                tooltip.style("opacity", 1)
                    .html(`<strong>Paese:</strong> ${d.properties.NAME}<br><strong>Eventi:</strong> ${count}`)
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 15) + "px");
            })
            .on("mousemove", (event) => {
                tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
            })
            .on("mouseout", function(event, d) {
                const count = countsMap.get(d.properties.NAME) || 0;
                d3.select(this).attr("stroke", "#fff").attr("stroke-width", 0.5)
                    .attr("fill", count > 0 ? colorScale(count) : "#eee");
                tooltip.style("opacity", 0);
            })
            .on("click", (event, d) => {
                // Controllo proprietà ISO (alcuni file usano ISO_A3 o id)
                const isoCode = d.properties.ISO3 || d.properties.ISO_A3 || d.id;
                console.log("Cliccato su:", d.properties.NAME, "Codice:", isoCode);
                
                if (!isZoomed && isoCode) {
                    loadDetail(isoCode, d.properties.NAME);
                }
            });
    }

    function loadDetail(iso, countryName) {
        d3.select(".map-filters").style("visibility", "hidden");
        const path = `../../data/proj/countries/${iso}.json`;

        if (geoCache.has(iso)) {
            renderCountryDetail(geoCache.get(iso), countryName);
        } else {
            d3.json(path).then(detailGeojson => {
                geoCache.set(iso, detailGeojson);
                renderCountryDetail(detailGeojson, countryName);
            }).catch(err => {
                console.error("Errore caricamento:", path, err);
                alert("Dati regionali non trovati per: " + countryName + " (Codice: " + iso + ")");
                d3.select(".map-filters").style("visibility", "visible");
            });
        }
    }

    function renderCountryDetail(geo, name) {
        isZoomed = true;
        overlay.style("display", "block").style("opacity", 1);
        detailGroup.selectAll("*").remove();
        detailGroup.style("display", "block").style("opacity", 1);

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

        projection.fitExtent([[120, 50], [width * 0.75, height - 150]], geo);

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
            .data(geo.features)
            .join("path")
            .attr("d", pathGenerator)
            .attr("stroke", "#444")
            .attr("fill", d => {
                const reg = d.properties.NAME_1 || d.properties.name;
                const count = adminCounts.get(reg) || 0;
                return count > 0 ? adminColor(count) : "#ffffff";
            })
            .on("mouseover", function(event, d) {
                const reg = d.properties.NAME_1 || d.properties.name;
                const count = adminCounts.get(reg) || 0;
                d3.select(this).attr("fill", "orange").attr("stroke", "#000").attr("stroke-width", 2);
                tooltip.style("opacity", 1)
                    .html(`<strong>Regione:</strong> ${reg}<br><strong>Eventi:</strong> ${count}`)
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 15) + "px");
            })
            .on("mousemove", (event) => {
                tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
            })
            .on("mouseout", function(event, d) {
                const reg = d.properties.NAME_1 || d.properties.name;
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

    // --- HOW TO READ THE CHART? ---
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

}).catch(err => console.error("Errore Caricamento:", err));