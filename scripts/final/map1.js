// File: geoChoropleth.js 

const GENERAL_GEOJSON_PATH = "../../data/europe.geojson";
const GENERAL_ATTACKS_JSON_PATH = "../../data/lab5/GeoExplosions.json";

Promise.all([
    d3.json(GENERAL_GEOJSON_PATH),
    d3.json(GENERAL_ATTACKS_JSON_PATH)
]).then(function([geojson, raw_attacks_data]) {

    const width = 1000;
    const height = 600;
    const marginLeft = 10;
    const marginRight = 70;
    const marginBottom = 20;
    const marginTop = 40; 

    const mapWidth = width - (marginRight * 2); 
    const mapHeight = height - marginTop - marginBottom;

    let isZoomed = false;

    // --- 1. SETUP SVG ---
    const svg = d3.select("#geo-container")
        .attr("viewBox", [0, 0, width, height]);

    const projection = d3.geoMercator();
    const pathGenerator = d3.geoPath().projection(projection);

    const mapGroup = svg.append("g")
        .attr("transform", `translate(${marginLeft}, ${marginTop})`);

    // --- 2. PREPARAZIONE DATI ---
    // Mappiamo gli attacchi usando l'ID ISO3 che troviamo in europe.geojson
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

    // --- 4. FUNZIONE RENDER MAPPA ---
    function renderMap(data, isDetail = false) {
        projection.fitSize([mapWidth, mapHeight], data);

        const paths = mapGroup.selectAll("path")
            .data(data.features);

        paths.join(
            enter => enter.append("path")
                .attr("d", pathGenerator)
                .attr("fill", d => {
                    // Nel file europe.geojson l'ID è properties.ISO3
                    const id = d.properties.ISO3 || d.properties.id; 
                    return isDetail ? "#e0e0e0" : colorScale(countsMap.get(id) || 0);
                })
                .attr("stroke", "#fff")
                .attr("stroke-width", isDetail ? 0.5 : 0.8)
                .style("opacity", 0)
                .call(e => e.transition().duration(500).style("opacity", 1)),
            update => update
                .transition().duration(500)
                .attr("d", pathGenerator)
                .attr("fill", d => {
                    const id = d.properties.ISO3 || d.properties.id;
                    return isDetail ? "#e0e0e0" : colorScale(countsMap.get(id) || 0);
                }),
            exit => exit.transition().duration(300).style("opacity", 0).remove()
        )
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("fill", "orange");
            
            // CORREZIONE ATTRIBUTI:
            // Europe usa .NAME, le regioni Ucraina solitamente .NAME_1 o .name
            const name = d.properties.NAME || d.properties.NAME_1 || d.properties.name || "Sconosciuto";
            const id = d.properties.ISO3 || d.properties.id;
            const count = countsMap.get(id) || 0;

            tooltip.style("opacity", 1)
                .html(`<strong>${name}</strong>${isDetail ? "" : `<br>Attacchi: ${count}`}`);
        })
        .on("mousemove", (event) => {
            tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
        })
        .on("mouseout", function(event, d) {
            const id = d.properties.ISO3 || d.properties.id;
            d3.select(this).attr("fill", isDetail ? "#e0e0e0" : colorScale(countsMap.get(id) || 0));
            tooltip.style("opacity", 0);
        })
        .on("click", function(event, d) {
            if (!isZoomed) {
                const countryId = d.properties.ISO3; // Recuperiamo "UKR"
                console.log("Paese cliccato:", d.properties.NAME, "ID:", countryId);
                if (countryId) loadCountryDetail(countryId);
            }
        });
    }
    
    // --- 5. CARICAMENTO DETTAGLIO ---
    function loadCountryDetail(countryId) {
        // Percorso dinamico: se countryId è "UKR", cerca "UKR.json"
        // Modifica qui il percorso se i file sono in una cartella diversa
        let path = `../../data/regions/${countryId}.json`;
        
        // Se il file si chiama esattamente come quello caricato nel test:
        if (countryId === "UKR") path = "../../data/UKR.json";

        d3.json(path).then(detailGeojson => {
            isZoomed = true;
            renderMap(detailGeojson, true);
            
            svg.select(".back-button").style("display", "block");
            svg.select(".graph-title").text(`Dettaglio: ${countryId}`);
        }).catch(err => {
            console.error("Errore nel caricamento del file di dettaglio:", path, err);
            alert("Dati non disponibili per " + countryId);
        });
    }

    // --- 6. UI: PULSANTE INDIETRO E TITOLO ---
    const backBtn = svg.append("g")
        .attr("class", "back-button")
        .style("display", "none")
        .attr("transform", `translate(20, ${height - 40})`)
        .style("cursor", "pointer")
        .on("click", () => {
            isZoomed = false;
            renderMap(geojson, false);
            svg.select(".back-button").style("display", "none");
            svg.select(".graph-title").text("Geographic distribution of explosions");
        });

    backBtn.append("rect").attr("width", 100).attr("height", 30).attr("rx", 5).attr("fill", "#333");
    backBtn.append("text").attr("x", 50).attr("y", 20).attr("text-anchor", "middle").attr("fill", "#fff").text("← Indietro");

    svg.append("text")
        .attr("class", "graph-title")
        .attr("x", width / 2).attr("y", marginTop / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "18px").style("font-weight", "bold")
        .text("Geographic distribution of explosions");

    // --- AVVIO ---
    renderMap(geojson, false);

}).catch(err => console.error("Errore caricamento dati principali:", err));