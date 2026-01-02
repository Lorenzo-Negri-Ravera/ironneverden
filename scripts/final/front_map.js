// File: conflictMap.js

const UKR_PATH = "../../data/final/geojson/countries/UKR.json";
const RUS_PATH = "../../data/final/geojson/countries/RUS.json";
// const BATTLES_PATH = "../../data/lab5/battles.json";  

Promise.all([
    d3.json(UKR_PATH),
    d3.json(RUS_PATH),
    // d3.json(BATTLES_PATH) 
]).then(function([ukrGeo, rusGeo /*, battlesData */]) { 
    
    // Dimensions and margins
    const width = 1000;
    const height = 700;
    const marginTop = 50; 

    // Build SVG container
    const svg = d3.select("#front-map-container") 
    .attr("viewBox", [0, 0, width, height])
    .style("width", "100%") 
    .style("height", "auto")
    .style("border", "0.5px solid #000000") 
    .style("background-color", "#ffffff"); 

    // Map Setup
    const projection = d3.geoMercator();
    const pathGenerator = d3.geoPath().projection(projection);

    const mapGroup = svg.append("g").attr("transform", `translate(0, ${marginTop})`);

    // Data preparation: define the interested Russian regions
    const westernRussiaIds = [
        "RUORL", "RUBEL", "RUKRS", "RUBRY", "RUVOR", "RUROS", "RUVGG", "RUTAM", "RULIP",
        "RUMOS", "RUMOW", // Mosca
        "RUKL", "RUKLU", "RUTUL", "RURYA" // Regioni per collegare Mosca
        //"RUVLA", "RUYAR", "RUTVE", 
        //"RUSMO", //"RUPNZ", , //"RUSAR", "RUIVA"  
    ]; 

    // Filters and combines GeoJSON features (Russia and Ukraine)
    const rusFeatures = rusGeo.features.filter(d => westernRussiaIds.includes(d.properties.id));
    const combinedFeatures = [
        ...ukrGeo.features.map(d => ({ ...d, country: "Ukraine" })),
        ...rusFeatures.map(d => ({ ...d, country: "Russia" }))
    ];
    const combinedGeoJSON = {type: "FeatureCollection", features: combinedFeatures };

    // Adjust projection to fit both countries
    projection.fitExtent([[30, 10], [width * 0.9, height - 100]], combinedGeoJSON);   
    
    // Drawing the map regions with styles -- black border only outside
    svg.append("defs")
        .append("filter")
        .attr("id", "outer-border")
        .append("feDropShadow")
        .attr("dx", 0) 
        .attr("dy", 0) 
        .attr("stdDeviation", 1.5) 
        .attr("flood-color", "#000000"); 

    // Ukraine 
    const ukraineGroup = mapGroup.append("g")
        .attr("id", "ukraine-group")
        .style("filter", "url(#outer-border)"); // Black border only outside

    ukraineGroup.selectAll(".region-ukr")
        .data(ukrGeo.features)
        .join("path")
        .attr("class", "region-ukr")
        .attr("d", pathGenerator)
        .attr("fill", "#888888")
        .attr("stroke", "#ffffff") // Internal borders white
        .attr("stroke-width", 0.5);

    // Russia
    const russiaGroup = mapGroup.append("g")
        .attr("id", "russia-group")
        .style("filter", "url(#outer-border)"); // Black border only outside

    russiaGroup.selectAll(".region-rus")
        .data(rusFeatures)
        .join("path")
        .attr("class", "region-rus")
        .attr("d", pathGenerator)
        .attr("fill", "#e5e5e5")
        .attr("stroke", "#ffffff") // Internal borders white
        .attr("stroke-width", 0.5);

    // Drawing a mask to highlight the Ukraine-Russia border
    svg.append("defs")
        .append("clipPath")
        .attr("id", "clip-russia")
        .append("path")
        .datum({type: "FeatureCollection", features: rusFeatures}) 
        .attr("d", pathGenerator);

    // Drawing the highlighted border in red between Ukraine and Russia
    mapGroup.append("path")
        .datum(ukrGeo) 
        .attr("d", pathGenerator)
        .attr("fill", "none")
        .attr("stroke", "#ff0000") 
        .attr("stroke-width", 2)   
        .attr("clip-path", "url(#clip-russia)") 
        .attr("pointer-events", "none")
        .attr("stroke-linecap", "round");


    // Title 
    svg.append("text")
        .attr("class", "graph-title")
        .attr("x", width / 2)
        .attr("y", marginTop / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .text("Battlefront Map: Ukraine vs Russia");


    /* --- Logic for the Battles --- */
    // Will need in future with the availability of data
    /*
    const eventGroup = mapGroup.append("g"); // Usiamo mapGroup per coerenza coordinate
    const tooltip = d3.select("#tooltip");

    function updateEvents(year) {
        const filteredData = battlesData.filter(d => +d.year === +year);

        eventGroup.selectAll("circle")
            .data(filteredData)
            .join("circle")
            .attr("cx", d => projection([+d.longitude, +d.latitude])[0])
            .attr("cy", d => projection([+d.longitude, +d.latitude])[1])
            .attr("r", 6)
            .attr("fill", "red")
            .attr("opacity", 0.7)
            .on("mouseover", (event, d) => {
                tooltip.style("opacity", 1).html(d.description);
            })
            .on("mousemove", (event) => {
                tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
            })
            .on("mouseout", () => tooltip.style("opacity", 0));
    }

    d3.select("#year-slider").on("input", function() {
        const val = +this.value;
        d3.select("#year-display").text(val);
        updateEvents(val);
    });

    updateEvents(2022);
    */

    // --- 6. HOW TO READ THE CHART? (Standardizzato dal Codice 1) ---
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

}).catch(err => {
    console.error("ERRORE CARICAMENTO DATI:", err);
});