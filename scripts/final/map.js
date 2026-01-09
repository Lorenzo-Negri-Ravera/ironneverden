// File: geoChoropleth.js 

const GENERAL_GEOJSON_PATH = "../../data/final/geojson/europe_final.geojson";
const COUNTRIES_EVENTS_PATH = "../../data/final/df_country_summary_v4.json";
const ADMIN_EVENTS_PATH = "../../data/final/df_admin_summary_v4.json";

// --- CONFIGURAZIONE LAYOUT SPECIALI (AGGIORNATA: Box a Destra + Zoom Portogallo) ---
const SPECIAL_COUNTRY_LAYOUTS = {
    // PORTOGALLO
    "PRT": { 
        check: (props) => ["Azores", "Madeira"].includes(props.NAME_1), 
        inset: { 
            x: 750,     // Spostato a destra (1000 - 350 - margine)
            y: 415,     // Alzato un po' per centrarlo nello spazio vuoto
            w: 200,     // MOLTO più grande (prima era 220) per "zoomare" le isole
            h: 200,     // Altezza proporzionale
            title: "Azores & Madeira" 
        } 
    },

    // SPAGNA
    "ESP": { 
        check: (props) => ["IslasCanarias"].includes(props.NAME_1), 
        inset: { 
            x: 750,     // Spostato a destra (1000 - 220 - margine)
            y: 415,     // In basso a destra
            w: 200, 
            h: 200, 
            title: "Canary Islands" 
        } 
    }
};

Promise.all([
    d3.json(GENERAL_GEOJSON_PATH),
    d3.json(COUNTRIES_EVENTS_PATH),
    d3.json(ADMIN_EVENTS_PATH)
]).then(function([geojson, country_data, admin_data]) {

    // Dimensions
    const width = 1000;
    const height = 700;

    // Build SVG container
    const svg = d3.select("#geo-container")
        .attr("viewBox", [0, 0, width, height])
        .style("width", "100%")
        .style("height", "auto")
        .style("background-color", "#f8f9fa") 
        .style("border", "1px solid #dee2e6")  
        .style("border-radius", "8px");        
    
    // SETUP CONTENITORE PER I BOTTONI
    const svgParent = d3.select(svg.node().parentNode);
    svgParent.style("position", "relative"); 

    // --- 1. DEFINIZIONE PROIEZIONE ---
    const projection = d3.geoIdentity().reflectY(true);
    const pathGenerator = d3.geoPath().projection(projection);

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

    projection.fitExtent([[0, 80], [width - 20, height - 20]], europeFocus);

    // --- GRUPPI SVG ---
    
    // 1. Gruppo Mappa Europa (Zoomabile nella vista principale)
    const mapGroup = svg.append("g");
    
    // 2. Overlay Sfondo (Statico)
    const overlay = svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "rgba(45, 45, 45, 0.9)")
        .style("display", "none")
        .style("pointer-events", "all");
    
    // 3. Gruppo Mappa Dettaglio (Zoomabile nella vista dettaglio)
    const detailMapGroup = svg.append("g").style("display", "none");

    // 4. Gruppo UI Dettaglio (Titoli e Bottoni - STATICO, NON ZOOMABILE)
    const detailUiGroup = svg.append("g").style("display", "none");

    // Variabile di stato per lo zoom
    let isDetailMode = false;

    // --- LEGENDA ---
    const legendGroup = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - 220}, ${height - 45})`); 

    // --- DEFINIZIONE ZOOM ---
    const zoom = d3.zoom()
        .scaleExtent([1, 12]) 
        .on("zoom", (event) => {
            if (isDetailMode) {
                // Se siamo nel dettaglio, muovi SOLO la geometria del paese
                detailMapGroup.attr("transform", event.transform);
            } else {
                // Se siamo in Europa, muovi la mappa generale
                mapGroup.attr("transform", event.transform);
            }
            tooltip.style("opacity", 0); 
        });

    svg.call(zoom)
       .on("dblclick.zoom", null); 

    // --- BOTTONI ZOOM ---
    const zoomBar = svgParent.append("div")
        .attr("class", "zoom-bar")
        .style("position", "absolute")
        .style("top", "20px")   
        .style("right", "20px") 
        .style("z-index", "100") 
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
        .on("click", () => { 
            if(isDetailMode) {
                svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
            } else {
                d3.select("#select-country").property("value", "All");
                svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity); 
            }
        });

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

    const colorScale = d3.scaleSqrt().range(["#fee5d9", "#C8102E"]);

    // Populate selectors & Helpers
    const getYear = (d) =>  d.YEAR;
    const getEvents = (d) => d.EVENTS;
    const getSubEvents = (d) => d.SUB_EVENT_TYPE || d.sub_event_type;

    const uniqueYears = [...new Set(country_data.map(d => getYear(d)))].filter(d => d).sort(d3.descending);
    const uniqueEvents = [...new Set(country_data.map(d => d.EVENT_TYPE))].filter(d => d).sort();

    const yearSelect = d3.select("#select-year");
    yearSelect.selectAll("option.dyn-year").data(uniqueYears).join("option").attr("class", "dyn-year").attr("value", d => d).text(d => d);

    const eventSelect = d3.select("#select-event");
    eventSelect.selectAll("option.dyn-event").data(uniqueEvents).join("option").attr("class", "dyn-event").attr("value", d => d).text(d => d);

    const countrySelect = d3.select("#select-country");
    const uniqueCountries = geojson.features
        .map(d => d.properties.NAME)
        .sort((a, b) => a.localeCompare(b));
    
    countrySelect.selectAll("option.dyn-country")
        .data(uniqueCountries)
        .join("option")
        .attr("class", "dyn-country")
        .attr("value", d => d)
        .text(d => d);

    countrySelect.on("change", function() {
        const selectedCountry = this.value;
        if (selectedCountry === "All") {
            if(isDetailMode) closeDetail();
            else svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
        } else {
            const feature = geojson.features.find(d => d.properties.NAME === selectedCountry);
            if (feature) {
                if(isDetailMode) closeDetail();
                zoomToBox(feature);
            }
        }
    });

    function zoomToBox(feature) {
        const bounds = pathGenerator.bounds(feature);
        const dx = bounds[1][0] - bounds[0][0];
        const dy = bounds[1][1] - bounds[0][1];
        const x = (bounds[0][0] + bounds[1][0]) / 2;
        const y = (bounds[0][1] + bounds[1][1]) / 2;
        const scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / width, dy / height)));
        const translate = [width / 2 - scale * x, height / 2 - scale * y];

        svg.transition()
            .duration(750)
            .call(
                zoom.transform, 
                d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
            );
    }

    const geoCache = new Map();

    function getGeoName(d) { return d.properties.NAME; }
    function getGeoISO(d) { return d.properties.ISO || d.properties.ISO3; }

    function generateTooltipContent(title, records) {
        if (!records || records.length === 0) {
            return `<div class='tooltip-header'><strong>${title}</strong></div>No events`;
        }
        const total = d3.sum(records, d => getEvents(d));
        const selectedEventType = eventSelect.property("value");
        const isEventSpecific = selectedEventType !== "All";
        const groupKey = isEventSpecific ? d => getSubEvents(d) : d => d.EVENT_TYPE;
        const breakdown = d3.rollup(records, v => d3.sum(v, d => getEvents(d)), groupKey);
        const sortedBreakdown = Array.from(breakdown).sort((a, b) => b[1] - a[1]);

        let html = `<div class='tooltip-header'><strong>${title}</strong></div>`;
        html += `<div><strong>Total Events: ${total}</strong></div>`;
        if (isEventSpecific) {
            html += `<div style='font-size:11px; color:#888; margin-bottom:4px;'>Breakdown of ${selectedEventType}:</div>`;
        }
        html += `<ul class='tooltip-list' style='margin-top:5px; padding-left:0;'>`;
        sortedBreakdown.forEach(([type, count]) => {
            const label = type || "Unspecified";
            html += `<li><span>${label}</span> <span>${count}</span></li>`;
        });
        html += `</ul>`;
        return html;
    }

    function updateLegend(maxVal) {
        legendGroup.selectAll("*").remove(); 
        const legendWidth = 200;
        const legendHeight = 10;

        const defs = svg.select("defs").empty() ? svg.append("defs") : svg.select("defs");
        defs.select("#linear-gradient").remove();
        
        const linearGradient = defs.append("linearGradient")
            .attr("id", "linear-gradient");

        const stops = d3.range(0, 1.1, 0.1); 
        linearGradient.selectAll("stop")
            .data(stops)
            .enter().append("stop")
            .attr("offset", d => d * 100 + "%")
            .attr("stop-color", d => colorScale(d * maxVal));

        legendGroup.append("rect")
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .style("fill", "url(#linear-gradient)")
            .style("stroke", "#ccc")
            .style("stroke-width", 0.5);

        legendGroup.append("text")
            .attr("x", 0)
            .attr("y", legendHeight + 15)
            .style("font-size", "10px")
            .text("0");

        legendGroup.append("text")
            .attr("x", legendWidth)
            .attr("y", legendHeight + 15)
            .attr("text-anchor", "end")
            .style("font-size", "10px")
            .style("font-weight", "bold")
            .text(maxVal);
            
        legendGroup.append("text")
            .attr("x", 0)
            .attr("y", -5)
            .style("font-size", "11px")
            .style("font-weight", "bold")
            .text("Number of Events");
    }

    function updateVisualization() {
        if(isDetailMode) return;

        const selYear = yearSelect.property("value");
        const selEvent = eventSelect.property("value");

        const filtered = country_data.filter(d => {
            const y = getYear(d);
            return (selYear === "All" || (y && y.toString() === selYear)) &&
                   (selEvent === "All" || d.EVENT_TYPE === selEvent);
        });

        const dataGrouped = d3.group(filtered, d => d.COUNTRY);
        const maxVal = d3.max(Array.from(dataGrouped.values()), rows => d3.sum(rows, d => getEvents(d))) || 1;

        colorScale.domain([0, maxVal]);
        updateLegend(maxVal);

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
                const records = dataGrouped.get(name) || [];
                const c = d3.sum(records, r => getEvents(r));
                return c > 0 ? colorScale(c) : "#eee";
            });

        countries
            .on("mouseover", function(event, d) {
                const name = getGeoName(d);
                const records = dataGrouped.get(name) || [];
                d3.select(this).attr("fill", "orange").attr("stroke", "#000").attr("stroke-width", 1);
                const htmlContent = generateTooltipContent(name, records);
                tooltip.style("opacity", 1)
                    .html(htmlContent)
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 15) + "px");
            })
            .on("mousemove", (event) => {
                tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
            })
            .on("mouseout", function(event, d) {
                const name = getGeoName(d);
                const records = dataGrouped.get(name) || [];
                const c = d3.sum(records, r => getEvents(r));
                d3.select(this).attr("stroke", "#fff").attr("stroke-width", 0.5)
                    .attr("fill", c > 0 ? colorScale(c) : "#eee");
                tooltip.style("opacity", 0);
            })
            .on("click", (event, d) => {
                const isoCode = getGeoISO(d);
                const name = getGeoName(d);
                if (isoCode) {
                    loadDetail(isoCode, name);
                }
            });
    }

    function loadDetail(iso, countryName) {
        d3.select(".map-filters").style("visibility", "hidden");
        legendGroup.style("opacity", 0);

        const upperISO = iso.toUpperCase();
        const path = `../../data/final/geojson/countriesv2/${upperISO}.geojson`;

        if (geoCache.has(upperISO)) {
            renderCountryDetail(geoCache.get(upperISO), countryName, upperISO);
        } else {
            d3.json(path).then(detailGeojson => {
                geoCache.set(upperISO, detailGeojson);
                renderCountryDetail(detailGeojson, countryName, upperISO);
            }).catch(err => {
                console.error("Loading error:", path, err);
                alert("Regional data missing for: " + countryName);
                d3.select(".map-filters").style("visibility", "visible");
                legendGroup.style("opacity", 1);
            });
        }
    }

    // --- RENDER COUNTRY DETAIL (LOGICA BASATA SUI NOMI) ---
    function renderCountryDetail(geo, name, isoCode) {
        // 1. Reset e UI
        isDetailMode = true;
        svg.call(zoom.transform, d3.zoomIdentity);
        d3.select(".zoom-bar").style("top", "90px");
        
        overlay.style("display", "block").style("opacity", 1);
        detailMapGroup.selectAll("*").remove();
        detailMapGroup.style("display", "block").style("opacity", 1);
        detailUiGroup.selectAll("*").remove();
        detailUiGroup.style("display", "block").style("opacity", 1);
        legendGroup.style("opacity", 1); 

        // 2. Preparazione Dati (Eventi e Colori)
        const selYear = yearSelect.property("value");
        const selEvent = eventSelect.property("value");

        const filteredAdmin = admin_data.filter(d => 
            d.COUNTRY === name &&
            d.GID_1 != null && 
            (selYear === "All" || (getYear(d) && getYear(d).toString() === selYear)) &&
            (selEvent === "All" || d.EVENT_TYPE === selEvent)
        );

        const regionDataMap = new Map();
        let nationalBaseRecords = [];

        filteredAdmin.forEach(d => {
            // Normalizziamo controllo ISO
            if (d.GID_1 === "ISO" || d.GID_1 === isoCode) {
                nationalBaseRecords.push(d);
            } else {
                if (!regionDataMap.has(d.GID_1)) regionDataMap.set(d.GID_1, []);
                regionDataMap.get(d.GID_1).push(d);
            }
        });

        const maxRegional = d3.max(Array.from(regionDataMap.values()), rows => d3.sum(rows, r => getEvents(r))) || 0;
        const nationalSum = d3.sum(nationalBaseRecords, r => getEvents(r));
        const totalMax = maxRegional + nationalSum;
        const adminColor = d3.scaleSqrt().domain([0, totalMax || 1]).range(["#fff5f0", "#99000d"]);
        colorScale.domain([0, totalMax || 1]);
        updateLegend(totalMax || 1);

        // Helper Disegno
        function drawFeatures(selection, features, projection) {
            const localPath = d3.geoPath().projection(projection);
            
            selection.selectAll("path")
                .data(features)
                .join("path")
                .attr("d", localPath)
                .attr("stroke", "#444")
                .attr("stroke-width", 1)
                .attr("vector-effect", "non-scaling-stroke")
                .attr("fill", d => {
                    const regionGID = d.properties.GID_1; 
                    const regionRecords = regionDataMap.get(regionGID) || [];
                    const totalVal = d3.sum(regionRecords, r => getEvents(r)) + nationalSum;
                    return totalVal > 0 ? adminColor(totalVal) : "#ffffff";
                })
                .on("mouseover", function(event, d) {
                    const regionGID = d.properties.GID_1;
                    const regionName = d.properties.NAME_1 || regionGID; 
                    const regionRecords = regionDataMap.get(regionGID) || [];
                    const combinedRecords = regionRecords.concat(nationalBaseRecords);

                    d3.select(this).attr("fill", "orange").attr("stroke", "#000").attr("stroke-width", 2);
                    tooltip.style("opacity", 1)
                        .html(generateTooltipContent(regionName, combinedRecords))
                        .style("left", (event.pageX + 15) + "px")
                        .style("top", (event.pageY - 15) + "px");
                })
                .on("mousemove", (event) => {
                    tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
                })
                .on("mouseout", function(event, d) {
                    const regionGID = d.properties.GID_1;
                    const regionRecords = regionDataMap.get(regionGID) || [];
                    const totalVal = d3.sum(regionRecords, r => getEvents(r)) + nationalSum;
                    d3.select(this).attr("stroke", "#444").attr("stroke-width", 1)
                        .attr("fill", totalVal > 0 ? adminColor(totalVal) : "#ffffff");
                    tooltip.style("opacity", 0);
                });
        }

        // 3. LOGICA SPLIT (MAINLAND vs INSET) - PROPRIETÀ NAME_1
        const layout = SPECIAL_COUNTRY_LAYOUTS[isoCode] || SPECIAL_COUNTRY_LAYOUTS[isoCode.substring(0,2)];
        
        let mainlandFeats = [];
        let insetFeats = [];
        let useSplitLayout = false;

        if (layout) {
            geo.features.forEach(f => {
                // Controllo diretto sul nome della proprietà
                if (f.properties && layout.check(f.properties)) {
                    insetFeats.push(f);
                } else {
                    mainlandFeats.push(f);
                }
            });

            // Usiamo il layout splittato SOLO se abbiamo trovato le isole specificate
            if (insetFeats.length > 0 && mainlandFeats.length > 0) {
                useSplitLayout = true;
            }
        }

        if (useSplitLayout) {
            // A. MAINLAND (Grande al centro)
            const mainProj = d3.geoIdentity().reflectY(true);
            mainProj.fitExtent([[50, 50], [width - 50, height - 50]], { type: "FeatureCollection", features: mainlandFeats });
            
            const mainGroup = detailMapGroup.append("g").attr("class", "mainland");
            drawFeatures(mainGroup, mainlandFeats, mainProj);

            // B. INSET (Isole nel box)
            const cfg = layout.inset;
            const insetGroup = detailMapGroup.append("g").attr("class", "inset-box");
            
            // Sfondo Box
            insetGroup.append("rect")
                .attr("x", cfg.x).attr("y", cfg.y)
                .attr("width", cfg.w).attr("height", cfg.h)
                .attr("fill", "white").attr("stroke", "#ccc").attr("rx", 4);

            // Titolo Box
            insetGroup.append("text")
                .attr("x", cfg.x + 10).attr("y", cfg.y + 20)
                .text(cfg.title)
                .style("font-size", "11px").style("font-weight", "bold").style("fill", "#333");

            // Mappa Inset
            const insetProj = d3.geoIdentity().reflectY(true);
            insetProj.fitExtent([[cfg.x + 10, cfg.y + 30], [cfg.x + cfg.w - 10, cfg.y + cfg.h - 10]], { type: "FeatureCollection", features: insetFeats });
            
            const insetMapGroup = insetGroup.append("g");
            drawFeatures(insetMapGroup, insetFeats, insetProj);

        } else {
            // C. STANDARD (Fallback o paesi normali)
            // Se non trova "Azores" o "Canarias", mostra tutto insieme come prima
            const stdProj = d3.geoIdentity().reflectY(true);
            stdProj.fitExtent([[50, 80], [width - 50, height - 50]], { type: "FeatureCollection", features: geo.features });
            
            const stdGroup = detailMapGroup.append("g").attr("class", "standard-view");
            drawFeatures(stdGroup, geo.features, stdProj);
        }

        // UI Titolo e Chiusura
        detailUiGroup.append("text")
            .attr("x", width/2).attr("y", 40)
            .attr("text-anchor", "middle").attr("fill", "white") 
            .style("font-size", "24px").text(name);

        const close = detailUiGroup.append("g")
            .attr("transform", `translate(${width - 40}, 40)`)
            .style("cursor", "pointer")
            .on("click", closeDetail);
        
        close.append("circle").attr("r", 15).attr("fill", "#333").attr("stroke", "#fff");
        close.append("text").attr("text-anchor", "middle").attr("dy", "0.35em").attr("fill", "white").text("X");
    }
    

    function closeDetail() {
        isDetailMode = false;
        svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
        d3.select("#select-country").property("value", "All");
        d3.select(".zoom-bar").style("top", "20px");

        overlay.style("display", "none");
        detailMapGroup.style("display", "none");
        detailUiGroup.style("display", "none");

        d3.select(".map-filters").style("visibility", "visible");
        tooltip.style("opacity", 0);
        legendGroup.style("opacity", 1);
        
        updateVisualization(); 
    }

    yearSelect.on("change", updateVisualization);
    eventSelect.on("change", updateVisualization);
    updateVisualization();

    if (typeof setupHelpButton === "function") {
         setupHelpButton(svg, width, height, {
            x: 30,
            y: height-30, 
            title: "Disorders in Europe",
            instructions: [
                "1. Dark intensity means more events (see Legend).",
                "2. Hover for a breakdown of event types.",
                "3. Click on a country to see details on its regions."
            ]
        });
    }

}).catch(err => console.error("Errore Caricamento:", err));