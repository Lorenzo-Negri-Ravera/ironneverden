// File: geoChoropleth.js 

const GENERAL_GEOJSON_PATH = "../../data/final/geojson/europe.geojson";
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
        .style("background-color", "#ffffff") 
        .style("border", "0.5px solid #000000");
    
    // Title
    svg.append("text")
        .attr("class", "graph-title")
        .attr("x", width / 2)
        .attr("y", marginTop / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .text("Disorders in Europe");

    // Map setup
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

    // Populate year and event type selectors of the menu
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

    // Cache for loaded geojsons
    const geoCache = new Map();

    // Function to update the map visualization
    function updateVisualization() {
        const selYear = yearSelect.property("value");
        const selEvent = eventSelect.property("value");

        // Filter data and event based on selections
        const filtered = country_data.filter(d => {
            const y = getYear(d);
            return (selYear === "All" || (y && y.toString() === selYear)) &&
                   (selEvent === "All" || d.EVENT_TYPE === selEvent);
        });

        // Compute counts per country
        const countsMap = d3.rollup(filtered, v => d3.sum(v, d => getEvents(d)), d => d.COUNTRY);
        colorScale.domain([0, d3.max(Array.from(countsMap.values())) || 1]);

        // Adjust projection for the visualization
        projection.fitExtent([[10, 10], [width * 0.7, height - 100]], geojson);

        // Draw countries
        const countries = mapGroup.selectAll("path")
            .data(geojson.features)
            .join("path")
            .attr("d", pathGenerator)
            .attr("stroke", "#fff")
            .attr("stroke-width", 0.5)
            .style("cursor", "pointer");

        // Apply colors with transition
        countries.transition().duration(400)
            .attr("fill", d => {
                const c = countsMap.get(d.properties.NAME) || 0;
                return c > 0 ? colorScale(c) : "#eee";
            });

        // Interactivity part
        countries
            .on("mouseover", function(event, d) {
                const count = countsMap.get(d.properties.NAME) || 0;
                d3.select(this).attr("fill", "orange").attr("stroke", "#000").attr("stroke-width", 1);
                tooltip.style("opacity", 1)
                    .html(`<strong>Country:</strong> ${d.properties.NAME}<br><strong>#Events:</strong> ${count}`)
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
                const isoCode = d.properties.ISO3 || d.properties.ISO_A3 || d.id;
                console.log("Clicked on:", d.properties.NAME, "Code:", isoCode);
                
                // Upload detail only if not zoomed and isoCode is valid
                if (!isZoomed && isoCode) {
                    loadDetail(isoCode, d.properties.NAME);
                }
            });
    }

    // Function to load country detail (zoomed view on regions)
    function loadDetail(iso, countryName) {
        d3.select(".map-filters").style("visibility", "hidden");
        const path = `../../data/final/geojson/countries/${iso}.json`;

        if (geoCache.has(iso)) {
            renderCountryDetail(geoCache.get(iso), countryName);
        } else {
            d3.json(path).then(detailGeojson => {
                geoCache.set(iso, detailGeojson);
                renderCountryDetail(detailGeojson, countryName);
            }).catch(err => {
                console.error("Loading error:", path, err);
                alert("Regional data not found for: " + countryName + " (Code: " + iso + ")");
                d3.select(".map-filters").style("visibility", "visible");
            });
        }
    }

    // Function to render country detail view
    function renderCountryDetail(geo, name) {
        isZoomed = true;

        // Show overlay and detail group
        overlay.style("display", "block").style("opacity", 1);
        detailGroup.selectAll("*").remove();
        detailGroup.style("display", "block").style("opacity", 1);

        // Filter admin data for the selected country
        const selYear = yearSelect.property("value");
        const selEvent = eventSelect.property("value");

        // Filter admin data based on selections
        const filteredAdmin = admin_data.filter(d => 
            d.COUNTRY === name &&
            (selYear === "All" || (getYear(d) && getYear(d).toString() === selYear)) &&
            (selEvent === "All" || d.EVENT_TYPE === selEvent)
        );

        // Compute counts per administrative region
        const adminCounts = d3.rollup(filteredAdmin, v => d3.sum(v, d => getEvents(d)), d => d.ADMIN1);
        const adminMax = d3.max(Array.from(adminCounts.values())) || 1;
        const adminColor = d3.scaleSqrt().domain([0, adminMax]).range(["#fff5f0", "#99000d"]);

        // Adjust projection for the detail view
        projection.fitExtent([[120, 50], [width * 0.75, height - 150]], geo);

        // Draw detail map
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

        // Draw regions
        const g = detailGroup.append("g"); 
        g.selectAll("path")
            .data(geo.features)
            .join("path")
            .attr("d", pathGenerator)
            .attr("stroke", "#444")
            .attr("fill", d => {
                const reg = d.properties.name;
                const count = adminCounts.get(reg) || 0;
                return count > 0 ? adminColor(count) : "#ffffff";
            })

            // Interactivity for regions
            .on("mouseover", function(event, d) {
                const reg = d.properties.name;
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
                const reg = d.properties.name;
                const count = adminCounts.get(reg) || 0;
                d3.select(this).attr("stroke", "#444").attr("stroke-width", 1)
                    .attr("fill", count > 0 ? adminColor(count) : "#ffffff");
                tooltip.style("opacity", 0);
            });
    }

    // Function to close detail view
    function closeDetail() {
        isZoomed = false;
        overlay.style("display", "none");
        detailGroup.style("display", "none");
        d3.select(".map-filters").style("visibility", "visible");
        tooltip.style("opacity", 0);
        updateVisualization();
    }

    // Initial visualization
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
            "2. Hover on a country to see the number of events.",
            "3. Click on a country to see details on its regions.",
            "4. Click the 'X' to return to the main map."
        ]
    });

}).catch(err => console.error("Errore Caricamento:", err));