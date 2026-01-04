// File: ../../scripts/final/spikemap.js

(function() { 
    
    // --- CONFIGURAZIONE ---
    const PATHS = {
        geoRegion: "../../data/final/geojson/countries/UKR.json", 
        geoDistrict: "../../data/final/geojson/dinstrict/Ukraine_ADM2.topojson", 
        dataDistrict: "../../data/final/spikemap_ukr_province.csv"
    };

    const width = 1000;
    const height = 650;

    const svg = d3.select("#spike-container")
        .attr("viewBox", [0, 0, width, height])
        .style("overflow", "hidden");

    svg.selectAll("*").remove();

    const g = svg.append("g");

    // --- TOOLTIP ---
    let tooltip = d3.select("body").select(".shared-tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div")
            .attr("class", "shared-tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background", "rgba(255, 255, 255, 0.98)")
            .style("border", "1px solid #666") 
            .style("padding", "12px")         
            .style("border-radius", "6px")
            .style("font-family", "sans-serif")
            .style("font-size", "15px")       
            .style("pointer-events", "none")
            .style("z-index", "9999")
            .style("box-shadow", "0px 4px 8px rgba(0,0,0,0.2)"); 
    }

    const projection = d3.geoConicConformal()
        .parallels([44, 52])
        .rotate([-31, 0])
        .scale(3000) 
        .center([31.1656, 48.3794]); 

    const path = d3.geoPath().projection(projection);

    // --- SCALE (LOGARITMICA) ---
    // Range [3, 200]: Parte da 3px per rendere visibili anche i valori minimi
    const lenScale = d3.scaleLog().range([3, 200]); 
    const widScale = d3.scaleLinear().range([2, 30]);  

    // Layers
    const mapLayer = g.append("g").attr("class", "map-layer");
    const spikeLayer = g.append("g").attr("class", "spike-layer"); 

    console.log("Inizio caricamento dati mappa...");

    Promise.all([
        d3.json(PATHS.geoRegion),
        d3.json(PATHS.geoDistrict), 
        d3.csv(PATHS.dataDistrict)
    ]).then(([geoReg, topoDistData, csvDist]) => {

        console.log("File caricati.");

        // 1. Geometrie
        let geoDist;
        if (topoDistData.type === "Topology") {
            const key = Object.keys(topoDistData.objects)[0];
            geoDist = topojson.feature(topoDistData, topoDistData.objects[key]);
        } else {
            geoDist = topoDistData;
        }

        // 2. Pulizia Dati
        csvDist.forEach(d => { 
            d.fatalities = +d.fatalities; 
            d.year = d.year ? +d.year : null; 
        });

        // 3. Proiezione
        projection.fitSize([width, height], geoReg);

        // 4. DISEGNO MAPPA (REGIONI / OBLAST)
        mapLayer.selectAll("path")
            .data(geoReg.features) 
            .join("path")
            .attr("d", path)
            .attr("fill", "#f8f9fa")       
            .attr("stroke", "#d1d1d1")     
            .attr("stroke-width", 1.0) 
            .attr("vector-effect", "non-scaling-stroke")
            // Mouseover REGIONI
            .on("mouseover", function(e, d) {
                d3.select(this)
                    .attr("stroke", "#333") 
                    .attr("stroke-width", 2.0)
                    .attr("fill", "#e2e6ea") 
                    .raise(); 
                
                const name = d.properties.shapeName || d.properties.NAME_1 || d.properties.name || "Regione";
                
                tooltip.style("visibility", "visible").html(`
                    <div style="font-weight:bold;">${name}</div>
                `);
            })
            .on("mousemove", e => tooltip.style("top", (e.pageY-20)+"px").style("left", (e.pageX+20)+"px"))
            .on("mouseout", function() {
                d3.select(this)
                    .attr("stroke", "#d1d1d1")
                    .attr("stroke-width", 1.0)
                    .attr("fill", "#f8f9fa");
                tooltip.style("visibility", "hidden");
            });

        // 5. Mappatura Centroidi (SENZA CORREZIONI MANUALI)
        const csvDistNames = [...new Set(csvDist.map(d => d.admin2))];
        const districtCentroids = new Map();
        
        // Helper normalizzazione
        const normalize = str => str ? str.toLowerCase().trim().replace(/['`’]/g, "") : "";

        geoDist.features.forEach(f => {
            let geoName = f.properties.shapeName || f.properties.NAME_2 || f.properties.name || ""; 
            
            if (geoName) {
                const normGeo = normalize(geoName);
                
                // Match diretto tra GeoJSON e CSV
                const match = csvDistNames.find(c => {
                    const normCsv = normalize(c);
                    return normCsv === normGeo || normCsv.includes(normGeo) || normGeo.includes(normCsv);
                });

                if (match) {
                    const c = path.centroid(f);
                    if (!isNaN(c[0]) && !isNaN(c[1])) {
                        districtCentroids.set(match, c);
                    }
                }
            }
        });

        // 6. Scale Domains
        const districtTotals = d3.rollup(csvDist, v => d3.sum(v, d => d.fatalities), d => d.admin2);
        const globalMax = d3.max(Array.from(districtTotals.values())) || 1000;
        
        // LOGARITMICA: Da 1 a Max (Log(0) non esiste)
        lenScale.domain([1, Math.max(globalMax, 1)]);
        widScale.domain([0, globalMax]);

        // --- UPDATE FUNCTION ---
        function updateSpikes() {
            const showBattles = d3.select("#check-battles").property("checked");
            const showExplosions = d3.select("#check-explosions").property("checked");
            const yearToggle = d3.select("#year-toggle").property("checked");
            const slider = d3.select("#year-slider");
            const currentYear = +slider.property("value");
            
            slider.property("disabled", !yearToggle);
            d3.select("#year-display").text(yearToggle ? currentYear : "Tutti").style("opacity", yearToggle ? 1 : 0.5);

            const filterFn = (d) => {
                let yearOk = yearToggle ? (d.year === currentYear) : true;
                let typeOk = false;
                if (d.event_type === "Battles" && showBattles) typeOk = true;
                if (d.event_type === "Explosions/Remote violence" && showExplosions) typeOk = true;
                return typeOk && yearOk;
            };

            const aggregated = new Map(); 
            
            csvDist.forEach(d => {
                if (filterFn(d)) {
                    // NESSUNA CORREZIONE NOME QUI
                    let distName = d.admin2; 
                    
                    if (!aggregated.has(distName)) {
                        aggregated.set(distName, { value: 0, details: {} });
                    }
                    const item = aggregated.get(distName);
                    item.value += d.fatalities;
                    item.details[d.event_type] = (item.details[d.event_type] || 0) + d.fatalities;
                }
            });

            const spikeData = [];
            aggregated.forEach((data, distName) => {
                const centroid = districtCentroids.get(distName);
                if (centroid && data.value > 0) { 
                    spikeData.push({
                        name: distName,
                        value: data.value,
                        details: data.details,
                        x: centroid[0],
                        y: centroid[1]
                    });
                }
            });

            // --- DISEGNO CON GRUPPI (HITBOX) ---
            const groups = spikeLayer.selectAll(".spike-group")
                .data(spikeData, d => d.name);

            groups.exit()
                .transition().duration(500)
                .attr("opacity", 0)
                .remove();

            const enterGroups = groups.enter().append("g")
                .attr("class", "spike-group");
            
            // 1. Spike Visibile (Rosso)
            enterGroups.append("path")
                .attr("class", "spike-visual")
                .attr("fill", "#dc3545")
                .attr("stroke", "#8e0000")
                .attr("stroke-width", 0.5)
                .attr("fill-opacity", 0.8);

            // 2. Hitbox (Invisibile e largo)
            enterGroups.append("path")
                .attr("class", "spike-hitbox")
                .attr("fill", "transparent")
                .attr("stroke", "transparent")
                .attr("stroke-width", 25) // Area cliccabile estesa
                .style("cursor", "pointer");

            const allGroups = enterGroups.merge(groups);

            // Update Visibile
            allGroups.select(".spike-visual")
                .transition().duration(500)
                .attr("d", d => {
                    const valSafe = Math.max(1, d.value); // Protezione logaritmo
                    const h = lenScale(valSafe);
                    const w = widScale(d.value);
                    return spikePath(d.x, d.y, h, w);
                });

            // Update Hitbox (minimo 20px altezza)
            allGroups.select(".spike-hitbox")
                .attr("d", d => {
                    const valSafe = Math.max(1, d.value);
                    let h = lenScale(valSafe);
                    let w = widScale(d.value);
                    if (h < 20) { h = 20; w = 10; }
                    return spikePath(d.x, d.y, h, w);
                });

            // Mouse Events su Spike
            allGroups
                .on("mouseover", function(e, d) {
                    d3.select(this).select(".spike-visual")
                        .attr("fill", "#a71d2a")
                        .attr("fill-opacity", 1);
                    
                    const b = d.details["Battles"] || 0;
                    const ex = d.details["Explosions/Remote violence"] || 0;
                    const max = Math.max(b, ex, 1); 

                    tooltip.style("visibility", "visible").html(`
                        <div style="font-weight:bold;border-bottom:1px solid #ccc;margin-bottom:8px;padding-bottom:4px;font-size:16px;">${d.name}</div>
                        <div style="margin-bottom:8px;">Vittime: <strong style="font-size:16px;">${d.value.toLocaleString()}</strong></div>
                        <svg width="180" height="50">
                            <rect x="0" y="5" width="${(b/max)*100}" height="10" fill="#007bff"></rect> 
                            <text x="${(b/max)*100+5}" y="14" font-size="11">Bat: ${b}</text>
                            <rect x="0" y="25" width="${(ex/max)*100}" height="10" fill="#dc3545"></rect>
                            <text x="${(ex/max)*100+5}" y="34" font-size="11">Exp: ${ex}</text>
                        </svg>
                    `);
                })
                .on("mousemove", e => tooltip.style("top", (e.pageY-20)+"px").style("left", (e.pageX+20)+"px"))
                .on("mouseout", function() {
                    d3.select(this).select(".spike-visual")
                        .attr("fill", "#dc3545")
                        .attr("fill-opacity", 0.8);
                    tooltip.style("visibility", "hidden");
                });
        }

        function spikePath(x, y, h, w) { 
            return `M${x - w/2},${y} L${x},${y - h} L${x + w/2},${y} Z`; 
        }

        d3.selectAll("#check-battles, #check-explosions").on("change", updateSpikes);
        d3.select("#year-toggle").on("change", updateSpikes);
        d3.select("#year-slider").on("input", updateSpikes);

        updateSpikes();

    }).catch(err => {
        console.error("ERRORE CARICAMENTO:", err);
    });

})();