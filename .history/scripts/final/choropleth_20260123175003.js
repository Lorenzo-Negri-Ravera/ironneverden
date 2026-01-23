// File: choropleth.js 
(function () {
    const GENERAL_GEOJSON_PATH = "../../data/final/geojson/europe_final_simplest_v2.geojson";
    const COUNTRIES_EVENTS_PATH = "../../data/final/df_country_summary_v4.json";
    const ADMIN_EVENTS_PATH = "../../data/final/df_admin_summary_v4.json";

    // --- 1. CONFIGURAZIONE COLORI (NUOVA SEZIONE) ---
    // Definiamo un colore specifico per ogni tipologia di evento.
    // "All" userà il NEUTRAL_COLOR (il rosso originale o simile).
    const NEUTRAL_COLOR = "#6b3e10b1";

    const EVENT_COLORS = {
        "Battles": "#ff6361",
        "Explosions/Remote violence": "#ffa600",
        "Protests": "#1e88e5",
        "Riots": "#58508d",
        "Violence against civilians": "#bc5090",
        "Strategic developments": "#003f5c"
    };

    // --- 1. IMMEDIATE UI SETUP (Without waiting for data) ---

    // Dimensions
    const width = 1000;
    const height = 700;

    // Create SVG Container
    const svg = d3.select("#choropleth-container")
        .attr("viewBox", [0, 0, width, height]);

    // Parent for buttons and loader
    const svgParent = d3.select(svg.node().parentNode);

    // --- LOADER CREATION AND ACTIVATION ---
    const loader = svgParent.append("div")
        .attr("class", "chart-loader-overlay");

    loader.append("div").attr("class", "loader-spinner");

    // Helper Functions
    const showLoader = () => loader.style("display", "flex");
    const hideLoader = () => loader.style("display", "none");


    // --- SVG GROUPS ---
    const mapGroup = svg.append("g");

    // White overlay for detail view
    const overlay = svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "#f8f9fa")
        .style("display", "none")
        .style("opacity", 0);

    const detailMapGroup = svg.append("g").style("display", "none");
    const detailUiGroup = svg.append("g").style("display", "none");

    // Legend
    const legendGroup = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - 290}, ${height - 50})`);

    // --- STANDARDIZED TOOLTIP ---
    const tooltip = d3.select("body")
        .selectAll(".shared-tooltip.choropleth-tooltip")
        .data([0])
        .join("div")
        .attr("class", "shared-tooltip choropleth-tooltip")
        .style("opacity", 0);

    // State variables
    let isDetailMode = false;
    let currentDetailContext = null;
    const geoCache = new Map();

    // Islands Layout
    const SPECIAL_COUNTRY_LAYOUTS = {
        "PRT": {
            check: (props) => ["Azores", "Madeira"].includes(props.NAME_1),
            inset: { x: 750, y: 350, w: 180, h: 200, title: "Azores & Madeira" }
        },
        "ESP": {
            check: (props) => ["IslasCanarias"].includes(props.NAME_1),
            inset: { x: 750, y: 450, w: 150, h: 150, title: "Canary Islands" }
        },
        "FRA": {
            check: (props) => ["Corse"].includes(props.NAME_1),
            inset: { x: 20, y: 415, w: 150, h: 150, title: "Corsica" }
        }
    };

    // --- 2. DATA LOADING ---
    Promise.all([
        d3.json(GENERAL_GEOJSON_PATH),
        d3.json(COUNTRIES_EVENTS_PATH),
        d3.json(ADMIN_EVENTS_PATH)
    ]).then(function ([geojson, country_data, admin_data]) {

        // --- MODIFICA: Configurazione manuale per zoomare sull'Europa ---
        const projection = d3.geoMercator()
            .center([27, 55])                // Coordinate [Long, Lat] per centrare su Germania/Polonia
            .scale(500)                      // Livello di zoom (aumenta per ingrandire, diminuisci per rimpicciolire)
            .translate([width / 2, height / 2]); // Centra la mappa nell'SVG

        const pathGenerator = d3.geoPath().projection(projection);

        // (Nota: Ho rimosso europeFocus e projection.fitExtent perché usiamo center/scale manuali)


        // --- Zoom Logic ---
        const zoom = d3.zoom()
            .scaleExtent([1, 12])
            .translateExtent([[-200, -100], [width + 1200, height]])
            .on("zoom", (event) => {
                mapGroup.attr("transform", event.transform);
                detailMapGroup.attr("transform", event.transform);
                tooltip.style("opacity", 0);
            });

        svg.call(zoom).on("dblclick.zoom", null);

        d3.select("#zoom-in").on("click", () => svg.transition().call(zoom.scaleBy, 1.3));
        d3.select("#zoom-out").on("click", () => svg.transition().call(zoom.scaleBy, 0.7));
        d3.select("#zoom-reset").on("click", () => svg.transition().call(zoom.transform, d3.zoomIdentity));

        // Inizializzazione della scala (il range verrà sovrascritto dinamicamente)
        const colorScale = d3.scaleSqrt();

        // Data Helper functions
        const getYear = (d) => d.YEAR;
        const getEvents = (d) => d.EVENTS;
        const getSubEvents = (d) => d.SUB_EVENT_TYPE || d.sub_event_type;
        const getGeoName = (d) => d.properties.NAME;
        const getGeoISO = (d) => d.properties.ISO || d.properties.ISO3;

        // Populate Selects
        const uniqueYears = [...new Set(country_data.map(d => getYear(d)))].filter(d => d).sort(d3.descending);
        const uniqueEvents = [...new Set(country_data.map(d => d.EVENT_TYPE))].filter(d => d).sort();
        const uniqueCountries = geojson.features.map(d => d.properties.NAME).sort((a, b) => a.localeCompare(b));

        const yearSelect = d3.select("#select-year");
        yearSelect.selectAll("option.dyn-year").data(uniqueYears).join("option").attr("class", "dyn-year").attr("value", d => d).text(d => d);

        const eventSelect = d3.select("#select-event");
        eventSelect.selectAll("option.dyn-event").data(uniqueEvents).join("option").attr("class", "dyn-event").attr("value", d => d).text(d => d);

        const countrySelect = d3.select("#select-country");
        countrySelect.selectAll("option.dyn-country").data(uniqueCountries).join("option").attr("class", "dyn-country").attr("value", d => d).text(d => d);

        // --- HYBRID LOGIC for Country Select ---
        countrySelect.on("change", function () {
            const selectedCountry = this.value;

            if (selectedCountry === "All") {
                if (isDetailMode) closeDetail();
                else svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
            } else {
                const feature = geojson.features.find(d => d.properties.NAME === selectedCountry);

                if (feature) {
                    if (isDetailMode) {
                        const iso = getGeoISO(feature);
                        const name = getGeoName(feature);
                        loadDetail(iso, name);
                    } else {
                        zoomToBox(feature);
                    }
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
            svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
        }

        function updateLegend(maxVal) {
            legendGroup.selectAll("*").remove();
            const legendWidth = 260;
            const legendHeight = 8;
            const defs = svg.select("defs").empty() ? svg.append("defs") : svg.select("defs");
            defs.select("#linear-gradient").remove();

            const linearGradient = defs.append("linearGradient").attr("id", "linear-gradient");
            const stops = d3.range(0, 1.1, 0.1);

            linearGradient.selectAll("stop")
                .data(stops)
                .enter()
                .append("stop")
                .attr("offset", d => (d * 100) + "%")
                .attr("stop-color", d => colorScale(d * maxVal));

            legendGroup.append("text")
                .attr("x", 0)
                .attr("y", -8)
                .style("font-family", "Fira Sans, sans-serif")
                .style("font-size", "11px")
                .style("font-weight", "600")
                .style("fill", "#6c757d")
                .text("Intensity (Number of Events)");

            legendGroup.append("rect")
                .attr("width", legendWidth)
                .attr("height", legendHeight)
                .style("fill", "url(#linear-gradient)")
                .attr("rx", 4);

            const axisScale = d3.scaleLinear().domain([0, maxVal]).range([0, legendWidth]);
            const axisBottom = d3.axisBottom(axisScale).ticks(4).tickSize(4).tickFormat(d3.format(".0f"));

            const axisGroup = legendGroup.append("g")
                .attr("class", "legend-axis")
                .attr("transform", `translate(0, ${legendHeight})`)
                .call(axisBottom);

            axisGroup.select(".domain").remove();
            axisGroup.selectAll("line").style("stroke", "#adb5bd");
            axisGroup.selectAll("text").style("font-family", "Fira Sans, sans-serif").style("font-size", "10px").style("fill", "#6c757d");
        }

        function preCalculateStats(records) {
            if (!records || records.length === 0) return null;
            const total = d3.sum(records, d => getEvents(d));
            const selectedEventType = d3.select("#select-event").property("value");
            const isEventSpecific = selectedEventType !== "All";
            const groupKey = isEventSpecific ? d => getSubEvents(d) : d => d.EVENT_TYPE;
            const breakdownMap = d3.rollup(records, v => d3.sum(v, d => getEvents(d)), groupKey);
            const sortedBreakdown = Array.from(breakdownMap).sort((a, b) => b[1] - a[1]);
            return { total: total, breakdown: sortedBreakdown, isEventSpecific: isEventSpecific, selectedType: selectedEventType };
        }

        // --- STANDARDIZED TOOLTIP RENDERING FUNCTION ---
        function renderTooltipHtml(title, stats) {
            if (!stats) return `<div class='tooltip-header'>${title}</div><div style="padding:0 5px;">No events</div>`;

            let html = `<div class='tooltip-header'>${title}</div>`;

            // Total Row
            html += `
        <div class="tooltip-row" style="margin-bottom:8px; border-bottom:1px dashed #eee; padding-bottom:5px;">
            <span class="tooltip-label" style="font-weight:700;">Total Events</span>
            <span class="tooltip-value">${stats.total}</span>
        </div>`;

            if (stats.isEventSpecific) {
                html += `<div style='font-size:11px; color:#888; margin-bottom:4px; font-style:italic;'>Breakdown of ${stats.selectedType}:</div>`;
            }

            // Breakdown Rows
            stats.breakdown.forEach(([type, count]) => {
                const label = type || "Unspecified";
                html += `
            <div class="tooltip-row">
                <span class="tooltip-label">
                    ${label}
                </span>
                <span class="tooltip-value">${count}</span>
            </div>`;
            });

            return html;
        }

        function updateVisualization() {
            if (isDetailMode && currentDetailContext) {
                renderCountryDetail(
                    currentDetailContext.geo,
                    currentDetailContext.name,
                    currentDetailContext.isoCode
                );
                return;
            }

            const selYear = yearSelect.property("value");
            const selEvent = eventSelect.property("value");

            // --- Logica Colori ---
            let targetColor = NEUTRAL_COLOR;
            if (selEvent !== "All") {
                targetColor = EVENT_COLORS[selEvent] || NEUTRAL_COLOR;
            }

            const lightTint = d3.interpolate(targetColor, "#ffffff")(0.85);
            colorScale.range([lightTint, targetColor]);

            const filtered = country_data.filter(d => {
                const y = getYear(d);
                return (selYear === "All" || (y && y.toString() === selYear)) && (selEvent === "All" || d.EVENT_TYPE === selEvent);
            });
            const dataGrouped = d3.group(filtered, d => d.COUNTRY);
            const statsCache = new Map();
            for (const [countryName, records] of dataGrouped) { statsCache.set(countryName, preCalculateStats(records)); }
            const maxVal = d3.max(Array.from(statsCache.values()), s => s.total) || 1;
            colorScale.domain([0, maxVal]);
            updateLegend(maxVal);

            const countries = mapGroup.selectAll("path").data(geojson.features).join("path")
                .attr("d", pathGenerator)
                .attr("vector-effect", "non-scaling-stroke")
                .attr("stroke", "#fff").attr("stroke-width", 0.5).attr("stroke-linejoin", "round")
                .style("cursor", "pointer");

            countries.transition().duration(400)
                .attr("fill", d => {
                    const name = getGeoName(d);
                    const stats = statsCache.get(name);
                    return (stats && stats.total > 0) ? colorScale(stats.total) : "#eee";
                });

            countries.on("mouseover", function (event, d) {
                d3.select(this).raise();
                const name = getGeoName(d);
                const stats = statsCache.get(name);

                d3.select(this).attr("fill", "#FFD700").attr("stroke", "#000").attr("stroke-width", 1.5);

                tooltip.style("opacity", 1)
                    .html(renderTooltipHtml(name, stats))
                    .style("visibility", "visible")
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 15) + "px");
            })
                .on("mousemove", (event) => {
                    tooltip.style("left", (event.pageX + 15) + "px")
                        .style("top", (event.pageY - 15) + "px");
                })
                .on("mouseout", function (event, d) {
                    const name = getGeoName(d);
                    const stats = statsCache.get(name);
                    d3.select(this).attr("stroke", "#fff").attr("stroke-width", 0.5)
                        .attr("fill", (stats && stats.total > 0) ? colorScale(stats.total) : "#eee");
                    tooltip.style("opacity", 0).style("visibility", "hidden");
                })
                .on("click", (event, d) => {
                    const isoCode = getGeoISO(d);
                    const name = getGeoName(d);
                    if (isoCode) {
                        countrySelect.property("value", name);
                        loadDetail(isoCode, name);
                    }
                });
        }

        function loadDetail(iso, countryName) {
            d3.select(".map-filters").style("visibility", "hidden");
            showLoader();

            const upperISO = iso.toUpperCase();
            const path = `../../data/final/geojson/countriesv2/${upperISO}.geojson`;

            if (geoCache.has(upperISO)) {
                renderCountryDetail(geoCache.get(upperISO), countryName, upperISO);
                hideLoader();
            } else {
                d3.json(path).then(detailGeojson => {
                    geoCache.set(upperISO, detailGeojson);
                    renderCountryDetail(detailGeojson, countryName, upperISO);
                    hideLoader();
                }).catch(err => {
                    console.error("Loading error:", path, err);
                    alert("Regional data missing for: " + countryName);
                    d3.select(".map-filters").style("visibility", "visible");
                    legendGroup.style("opacity", 1);
                    hideLoader();
                });
            }
        }

        function renderCountryDetail(geo, name, isoCode) {
            currentDetailContext = { geo, name, isoCode };

            isDetailMode = true;
            svg.call(zoom.transform, d3.zoomIdentity);
            d3.select("#zoom-controls").style("top", "75px");
            mapGroup.style("display", "none");
            overlay.attr("fill", "#f8f9fa").style("display", "block").style("opacity", 1);
            detailMapGroup.selectAll("*").remove(); detailMapGroup.style("display", "block").style("opacity", 1);
            detailUiGroup.selectAll("*").remove(); detailUiGroup.style("display", "block").style("opacity", 1);

            const selYear = yearSelect.property("value");
            const selEvent = eventSelect.property("value");

            // --- Colori per Detail View ---
            let targetColor = NEUTRAL_COLOR;
            if (selEvent !== "All") {
                targetColor = EVENT_COLORS[selEvent] || NEUTRAL_COLOR;
            }
            const lightTint = d3.interpolate(targetColor, "#ffffff")(0.85);
            colorScale.range([lightTint, targetColor]);

            const filteredAdmin = admin_data.filter(d => d.COUNTRY === name && d.GID_1 != null && (selYear === "All" || (getYear(d) && getYear(d).toString() === selYear)) && (selEvent === "All" || d.EVENT_TYPE === selEvent));

            const regionDataMap = new Map(); let nationalBaseRecords = [];
            filteredAdmin.forEach(d => {
                if (d.GID_1 === "ISO" || d.GID_1 === isoCode) nationalBaseRecords.push(d);
                else { if (!regionDataMap.has(d.GID_1)) regionDataMap.set(d.GID_1, []); regionDataMap.get(d.GID_1).push(d); }
            });

            const regionStatsCache = new Map();
            geo.features.forEach(feature => {
                const gid = feature.properties.GID_1;
                const specificRecords = regionDataMap.get(gid) || [];
                const combinedRecords = specificRecords.concat(nationalBaseRecords);
                regionStatsCache.set(gid, preCalculateStats(combinedRecords));
            });

            const maxRegional = d3.max(Array.from(regionStatsCache.values()), s => s ? s.total : 0) || 1;
            colorScale.domain([0, maxRegional]);
            updateLegend(maxRegional);

            legendGroup.raise(); legendGroup.style("opacity", 1);
            legendGroup.selectAll("text").style("fill", "black");
            legendGroup.select(".legend-axis line").style("stroke", "black");
            legendGroup.select(".legend-axis path").style("stroke", "black");

            function drawFeatures(selection, features, projection) {
                const localPath = d3.geoPath().projection(projection);
                selection.selectAll("path").data(features).join("path")
                    .attr("d", localPath).attr("vector-effect", "non-scaling-stroke")
                    .attr("stroke", "#444").attr("stroke-width", 1).attr("stroke-linejoin", "round")
                    .attr("fill", d => {
                        const stats = regionStatsCache.get(d.properties.GID_1);
                        return (stats && stats.total > 0) ? colorScale(stats.total) : "#ffffff";
                    })
                    .on("mouseover", function (event, d) {
                        d3.select(this).raise();
                        const regionGID = d.properties.GID_1; const regionName = d.properties.NAME_1 || regionGID;
                        const stats = regionStatsCache.get(regionGID);
                        d3.select(this).attr("fill", "#FFD700").attr("stroke", "#000").attr("stroke-width", 2);

                        tooltip.style("opacity", 1)
                            .html(renderTooltipHtml(regionName, stats))
                            .style("visibility", "visible")
                            .style("left", (event.pageX + 15) + "px")
                            .style("top", (event.pageY - 15) + "px");
                    })
                    .on("mousemove", (event) => {
                        tooltip.style("left", (event.pageX + 15) + "px")
                            .style("top", (event.pageY - 15) + "px");
                    })
                    .on("mouseout", function (event, d) {
                        const regionGID = d.properties.GID_1; const stats = regionStatsCache.get(regionGID);
                        d3.select(this).attr("stroke", "#444").attr("stroke-width", 1).attr("fill", (stats && stats.total > 0) ? colorScale(stats.total) : "#ffffff");
                        tooltip.style("opacity", 0).style("visibility", "hidden");
                    });
            }

            const layout = SPECIAL_COUNTRY_LAYOUTS[isoCode] || SPECIAL_COUNTRY_LAYOUTS[isoCode.substring(0, 2)];

            let mainlandFeats = [], insetFeats = [], useSplitLayout = false;
            if (layout) {
                geo.features.forEach(f => { if (f.properties && layout.check(f.properties)) insetFeats.push(f); else mainlandFeats.push(f); });
                if (insetFeats.length > 0 && mainlandFeats.length > 0) useSplitLayout = true;
            }

            // --- MODIFICA 2: Sostituiti tutti i geoIdentity().reflectY(true) con geoMercator() ---
            if (useSplitLayout) {
                const mainProj = d3.geoMercator();
                mainProj.fitExtent([[50, 50], [width - 50, height - 50]], { type: "FeatureCollection", features: mainlandFeats });
                const mainGroup = detailMapGroup.append("g"); drawFeatures(mainGroup, mainlandFeats, mainProj);

                const cfg = layout.inset;
                const insetGroup = detailMapGroup.append("g");

                insetGroup.append("rect")
                    .attr("x", cfg.x)
                    .attr("y", cfg.y)
                    .attr("width", cfg.w)
                    .attr("height", cfg.h)
                    .attr("fill", "white")
                    .attr("stroke", "#ccc")
                    .attr("rx", 4)
                    .attr("stroke-dasharray", "5,5")
                    .attr("stroke-width", 1);

                insetGroup.append("text")
                    .attr("x", cfg.x + 10)
                    .attr("y", cfg.y + 20)
                    .text(cfg.title)
                    .style("font-size", "11px")
                    .style("font-weight", "bold")
                    .style("fill", "black");

                const insetProj = d3.geoMercator();
                insetProj.fitExtent([[cfg.x + 10, cfg.y + 30], [cfg.x + cfg.w - 10, cfg.y + cfg.h - 10]], { type: "FeatureCollection", features: insetFeats });
                const insetMapGroup = insetGroup.append("g"); drawFeatures(insetMapGroup, insetFeats, insetProj);
            } else {
                const stdProj = d3.geoMercator();
                stdProj.fitExtent([[50, 80], [width - 50, height - 50]], { type: "FeatureCollection", features: geo.features });
                const stdGroup = detailMapGroup.append("g"); drawFeatures(stdGroup, geo.features, stdProj);
            }

            detailUiGroup.append("text").attr("x", width / 2).attr("y", 40).attr("text-anchor", "middle").attr("fill", "black").style("font-size", "24px").style("font-weight", "bold").text(name);

            // --- UX Button X ---
            const close = detailUiGroup.append("g")
                .attr("transform", `translate(${width - 40}, 40)`)
                .style("cursor", "pointer")
                .on("click", closeDetail);

            close.append("rect")
                .attr("width", 40)
                .attr("height", 40)
                .attr("x", -20)
                .attr("y", -20)
                .attr("fill", "transparent");

            close.append("text")
                .attr("text-anchor", "middle")
                .attr("dy", "0.35em")
                .attr("fill", "#25282A")
                .style("font-family", "sans-serif")
                .style("font-weight", "bold")
                .style("font-size", "24px")
                .text("✕");
        }

        function closeDetail() {
            isDetailMode = false;
            currentDetailContext = null;
            svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
            d3.select("#select-country").property("value", "All"); d3.select("#zoom-controls").style("top", "20px");
            overlay.style("display", "none"); detailMapGroup.style("display", "none"); detailUiGroup.style("display", "none");
            mapGroup.style("display", "block").style("opacity", 1); d3.select(".map-filters").style("visibility", "visible"); tooltip.style("opacity", 0);
            legendGroup.selectAll("text").style("fill", "#6c757d"); legendGroup.select(".legend-axis line").style("stroke", "#adb5bd"); legendGroup.select(".legend-axis path").style("stroke", "none");
            updateVisualization();
        }

        yearSelect.on("change", updateVisualization);
        eventSelect.on("change", updateVisualization);
        updateVisualization();

        hideLoader();

        const mapHelpContent = {
            title: "How to read the chart?",
            steps: [
                "Darker tonality indicates a higher number of conflict events.",
                "Hover over any country to see detailed statistics.",
                "Click over a country to explore regions statistics."
            ]
        };

        if (typeof createChartHelp === "function") {
            createChartHelp("#choropleth-help-container", "#choropleth-wrapper", mapHelpContent);
        }

    }).catch(err => {
        console.error("Loading Error:", err);
        d3.select(".loader-spinner").style("border-top", "5px solid red");
    })
}());