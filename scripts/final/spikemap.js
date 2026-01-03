// File: ../../scripts/final/spikemap.js

(function() { 
    
    // --- CONFIGURAZIONE ---
    const PATHS = {
        geoRegion: "../../data/final/geojson/countries/UKR.json",
        geoDistrict: "../../data/final/geojson/dinstrict/Ukraine_ADM2.topojson", 
        dataRegion: "../../data/final/spikemap_ukr_regioni.csv",
        dataDistrict: "../../data/final/spikemap_ukr_province.csv"
    };

    const width = 1000;
    const height = 650;

    const svg = d3.select("#spike-container")
        .attr("viewBox", [0, 0, width, height])
        .style("overflow", "hidden");

    const g = svg.append("g");

    // 1. ZOOM BEHAVIOR
    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });

    svg.call(zoom);

    // 2. BACKDROP (SFONDO NERO)
    const backdrop = g.append("rect")
        .attr("class", "overlay-backdrop")
        .attr("x", -width * 10).attr("y", -height * 10)
        .attr("width", width * 20).attr("height", height * 20)
        .attr("fill", "#000000") 
        .attr("opacity", 0)       
        .style("pointer-events", "none"); 

    // Tooltip
    let tooltip = d3.select("body").select(".shared-tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div")
            .attr("class", "shared-tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background", "rgba(255, 255, 255, 0.98)")
            .style("border", "1px solid #ccc")
            .style("padding", "8px")
            .style("border-radius", "4px")
            .style("font-family", "sans-serif")
            .style("font-size", "12px")
            .style("pointer-events", "none")
            .style("z-index", "9999");
    }

    const projection = d3.geoConicConformal()
        .parallels([44, 52])
        .rotate([-31, 0])
        .scale(3000) 
        .center([31.1656, 48.3794]); 

    const path = d3.geoPath().projection(projection);

    // --- SCALE ---
    const lenScaleReg = d3.scaleLinear().range([0, 200]); 
    const widScaleReg = d3.scaleLinear().range([0, 60]);  
    const lenScaleDist = d3.scaleLinear().range([0, 300]); 
    const widScaleDist = d3.scaleLinear().range([0, 40]);  

    // --- LAYERS ---
    const regionLayer = g.append("g").attr("class", "region-layer");
    const districtLayer = g.append("g").attr("class", "district-layer").style("display", "none");
    const spikeLayerReg = g.append("g").attr("class", "spike-layer-reg");
    const spikeLayerDist = g.append("g").attr("class", "spike-layer-dist").style("display", "none");

    let active = d3.select(null);
    let selectedRegionGeo = null; 
    let isResetting = false; // FLAG PER PREVENIRE FLICKERING
    const resetBtn = d3.select("#reset-btn");

    const regionNameMapping = {
        "Vinnytska": "Vinnytsia", "Volynska": "Volyn", "Dnipropetrovska": "Dnipropetrovsk",
        "Donetska": "Donetsk", "Zhytomyrska": "Zhytomyr", "Zakarpatska": "Zakarpattia",
        "Zaporizka": "Zaporizhia", "Ivano-Frankivska": "Ivano-Frankivsk", "Kyivska": "Kyiv",
        "Kirovohradska": "Kirovohrad", "Luhanska": "Luhansk", "Lvivska": "Lviv",
        "Mykolaivska": "Mykolaiv", "Odeska": "Odesa", "Poltavska": "Poltava",
        "Rivnenska": "Rivne", "Sumska": "Sumy", "Ternopilska": "Ternopil",
        "Kharkivska": "Kharkiv", "Khersonska": "Kherson", "Khmelnytska": "Khmelnytskyi",
        "Cherkaska": "Cherkasy", "Chernivetska": "Chernivtsi", "Chernihivska": "Chernihiv",
        "Avtonomna Respublika Krym": "Crimea", "Sevastopilska": "Crimea"
    };

    Promise.all([
        d3.json(PATHS.geoRegion),
        d3.json(PATHS.geoDistrict),
        d3.csv(PATHS.dataRegion),
        d3.csv(PATHS.dataDistrict)
    ]).then(([geoReg, topoDistData, csvReg, csvDist]) => {

        let geoDist;
        if (topoDistData.type === "Topology") {
            const key = Object.keys(topoDistData.objects)[0];
            geoDist = topojson.feature(topoDistData, topoDistData.objects[key]);
        } else {
            geoDist = topoDistData;
        }

        csvReg.forEach(d => { d.fatalities = +d.fatalities; d.year = d.year ? +d.year : null; });
        csvDist.forEach(d => { d.fatalities = +d.fatalities; d.year = d.year ? +d.year : null; });

        const globalMaxReg = d3.max(Array.from(d3.rollup(csvReg, v => d3.sum(v, d => d.fatalities), d => d.admin1).values())) || 100;
        const globalMaxDist = d3.max(Array.from(d3.rollup(csvDist, v => d3.sum(v, d => d.fatalities), d => d.admin2).values())) || 1000;

        lenScaleReg.domain([0, globalMaxReg]);
        widScaleReg.domain([0, globalMaxReg]);
        lenScaleDist.domain([0, globalMaxDist]);
        widScaleDist.domain([0, globalMaxDist]);

        const distNameMap = new Map();
        const csvDistNames = [...new Set(csvDist.map(d => d.admin2))];
        geoDist.features.forEach(f => {
            const geoName = f.properties.shapeName || f.properties.NAME_2 || f.properties.name; 
            if (geoName) {
                const match = csvDistNames.find(c => c.toLowerCase().includes(geoName.toLowerCase()));
                if (match) distNameMap.set(geoName, match);
            }
        });

        // --- UPDATE LOGIC ---
        function updateSpikes() {
            const showBattles = d3.select("#check-battles").property("checked");
            const showExplosions = d3.select("#check-explosions").property("checked");
            const yearToggle = d3.select("#year-toggle").property("checked");
            const slider = d3.select("#year-slider");
            const currentYear = +slider.property("value");
            
            slider.property("disabled", !yearToggle);
            d3.select("#year-display").text(yearToggle ? currentYear : "Tutti").style("opacity", yearToggle ? 1 : 0.5);

            const filterFn = (d) => {
                let typeOk = (d.event_type === "Battles" && showBattles) || (d.event_type === "Explosions/Remote violence" && showExplosions);
                let yearOk = yearToggle ? (d.year === currentYear) : true;
                return typeOk && yearOk;
            };

            const curRegMap = new Map(), detailsRegMap = new Map(), totalRegMap = new Map();
            csvReg.forEach(d => {
                if (filterFn(d)) {
                    curRegMap.set(d.admin1, (curRegMap.get(d.admin1)||0) + d.fatalities);
                    if (!detailsRegMap.has(d.admin1)) detailsRegMap.set(d.admin1, {});
                    detailsRegMap.get(d.admin1)[d.event_type] = (detailsRegMap.get(d.admin1)[d.event_type]||0) + d.fatalities;
                    totalRegMap.set(d.admin1, (totalRegMap.get(d.admin1)||0) + d.fatalities);
                }
            });

            const curDistMap = new Map(), detailsDistMap = new Map(), totalDistMap = new Map();
            csvDist.forEach(d => {
                if (filterFn(d)) {
                    curDistMap.set(d.admin2, (curDistMap.get(d.admin2)||0) + d.fatalities);
                    if (!detailsDistMap.has(d.admin2)) detailsDistMap.set(d.admin2, {});
                    detailsDistMap.get(d.admin2)[d.event_type] = (detailsDistMap.get(d.admin2)[d.event_type]||0) + d.fatalities;
                    totalDistMap.set(d.admin2, (totalDistMap.get(d.admin2)||0) + d.fatalities);
                }
            });

            let spikeDataReg = [];
            let spikeDataDist = [];

            if (selectedRegionGeo) {
                spikeDataReg = []; 
                spikeDataDist = geoDist.features.map(f => {
                    const geoName = f.properties.shapeName || f.properties.NAME_2 || f.properties.name;
                    const csvName = distNameMap.get(geoName);
                    if (!csvName) return null;
                    const center = d3.geoCentroid(f); 
                    if (!d3.geoContains(selectedRegionGeo, center)) return null; 

                    const c = path.centroid(f);
                    return { name: csvName, value: curDistMap.get(csvName)||0, total: totalDistMap.get(csvName)||0, x: c[0], y: c[1], level: 'district' };
                }).filter(d => d && !isNaN(d.x) && d.value > 0);

            } else {
                spikeDataReg = geoReg.features.map(f => {
                    const raw = f.properties.name || f.properties.NAME_1;
                    const name = regionNameMapping[raw] || raw;
                    let val = curRegMap.get(name)||0, tot = totalRegMap.get(name)||0;
                    if (name === "Kyiv") { val += curRegMap.get("Kyiv City")||0; tot += totalRegMap.get("Kyiv City")||0; }
                    const c = path.centroid(f);
                    return { name, value: val, total: tot, x: c[0], y: c[1], level: 'region' };
                }).filter(d => !isNaN(d.x));
                spikeDataDist = []; 
            }

            renderSpikes(spikeLayerReg, spikeDataReg, lenScaleReg, widScaleReg, detailsRegMap, true);
            renderSpikes(spikeLayerDist, spikeDataDist, lenScaleDist, widScaleDist, detailsDistMap, false);
        }

        function renderSpikes(layer, data, lScale, wScale, detMap, isReg) {
            const spikes = layer.selectAll(".spike").data(data, d => d.name);
            spikes.exit().remove();
            
            const enter = spikes.enter().append("path").attr("class", "spike")
                .attr("fill", "#dc3545").attr("stroke", "#8e0000").attr("stroke-width", isReg?1:0.5)
                .attr("vector-effect", "non-scaling-stroke").attr("fill-opacity", 0.8)
                .attr("d", d => spikePath(d.x, d.y, 0, 0));
                
            enter.merge(spikes).transition().duration(500)
                .attr("d", d => {
                    const h = lScale(d.value), w = wScale(d.value);
                    return h>0 ? spikePath(d.x, d.y, h, w) : spikePath(d.x, d.y, 0, 0);
                });
            
            layer.selectAll(".spike").on("mouseover", function(e, d) {
                if (d3.select(this).style("display") === "none") return;
                
                // Evita propagazione al distretto sotto
                e.stopPropagation();

                d3.select(this).attr("fill", "#a71d2a").attr("fill-opacity", 1);
                let det = detMap.get(d.name)||{};
                if (isReg && d.name === "Kyiv") {
                    const city = detMap.get("Kyiv City")||{};
                    det = { "Battles": (det.Battles||0)+(city.Battles||0), "Explosions/Remote violence": (det["Explosions/Remote violence"]||0)+(city["Explosions/Remote violence"]||0)};
                }
                const b = det["Battles"]||0, ex = det["Explosions/Remote violence"]||0;
                const max = Math.max(b, ex, 1);
                tooltip.style("visibility", "visible").html(`
                    <div style="font-weight:bold;border-bottom:1px solid #ccc;margin-bottom:5px;">${d.name}</div>
                    <div>Vittime: <strong>${d.total.toLocaleString()}</strong></div>
                    <svg width="150" height="40" style="margin-top:5px">
                        <rect x="0" y="5" width="${(b/max)*80}" height="8" fill="#007bff"></rect> 
                        <text x="${(b/max)*80+5}" y="12" font-size="9">Bat: ${b}</text>
                        <rect x="0" y="20" width="${(ex/max)*80}" height="8" fill="#dc3545"></rect>
                        <text x="${(ex/max)*80+5}" y="27" font-size="9">Exp: ${ex}</text>
                    </svg>
                `);
            }).on("mousemove", e => tooltip.style("top", (e.pageY-20)+"px").style("left", (e.pageX+20)+"px"))
            .on("mouseout", function() {
                d3.select(this).attr("fill", "#dc3545").attr("fill-opacity", 0.8);
                tooltip.style("visibility", "hidden");
            });
        }

        // --- RESET ---
        function reset() {
            // FIX: Blocca interazioni durante il reset
            isResetting = true;
            tooltip.style("visibility", "hidden"); 

            active.classed("active", false);
            active.classed("active-focus", false);
            active = d3.select(null);
            selectedRegionGeo = null; 
            
            resetBtn.style("display", "none");
            
            backdrop.transition().duration(750)
                .attr("opacity", 0).style("pointer-events", "none");

            spikeLayerDist.style("display", "none").style("opacity", 0);
            districtLayer.style("display", "none").style("opacity", 0);
            
            regionLayer.selectAll("path")
                .classed("hidden-totally", false)
                .classed("active-focus", false)
                .style("pointer-events", "all") 
                .transition().duration(500)
                .style("opacity", 1) 
                .attr("stroke", "#fff").attr("stroke-width", 0.8);

            spikeLayerReg.classed("hidden-layer", false)
                .style("display", "block")
                .transition().delay(100).style("opacity", 1);

            svg.transition().duration(750)
                .call(zoom.transform, d3.zoomIdentity) 
                .on("end", () => {
                    isResetting = false; // Sblocca interazioni alla fine
                    updateSpikes();
                });
        }

        // --- CLICK REGIONE ---
        function clickedRegion(event, d) {
            if (active.node() === this) return reset();
            active.classed("active", false);
            active = d3.select(this).classed("active", true);
            selectedRegionGeo = d; 
            
            resetBtn.style("display", "block");

            backdrop.style("pointer-events", "all")
                .transition().duration(500).attr("opacity", 1); 

            regionLayer.selectAll("path")
                .filter(function() { return this !== active.node(); })
                .classed("hidden-totally", true)
                .style("pointer-events", "none") // Disabilita click su altre regioni
                .transition().duration(500)
                .style("opacity", 0); 

            spikeLayerReg.style("display", "none"); 

            active.raise().classed("active-focus", true);
            d3.select(this).attr("stroke", "#fff").attr("stroke-width", 0.8);

            const [[x0, y0], [x1, y1]] = path.bounds(d);
            const dx = x1 - x0, dy = y1 - y0;
            const x = (x0 + x1) / 2, y = (y0 + y1) / 2;
            const scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / width, dy / height)));
            const translate = [width / 2 - scale * x, height / 2 - scale * y];

            const zoomTransform = d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale);

            svg.transition().duration(750)
                .call(zoom.transform, zoomTransform)
                .on("end", () => {
                    districtLayer.style("display", "block").transition().style("opacity", 1);
                    
                    // --- GESTIONE INTERATTIVITÀ DISTRETTI ---
                    districtLayer.selectAll("path")
                        .style("display", f => d3.geoContains(selectedRegionGeo, d3.geoCentroid(f)) ? "block" : "none")
                        .attr("stroke", "#999").attr("stroke-width", 0.3)
                        .attr("pointer-events", "all") 
                        .on("mouseover", function(e, f) {
                            if (isResetting) return; // FIX

                            d3.select(this)
                                .attr("stroke", "#000") // Nero
                                .attr("stroke-width", 1.5) 
                                .raise();

                            const distName = f.properties.shapeName || f.properties.NAME_2 || f.properties.name;
                            tooltip.style("visibility", "visible")
                                .html(`<div style="font-weight:bold; font-size:12px;">${distName}</div>`)
                                .style("top", (e.pageY - 30) + "px")
                                .style("left", (e.pageX + 15) + "px");
                        })
                        .on("mousemove", e => {
                            if (isResetting) return;
                            tooltip.style("top", (e.pageY - 30) + "px")
                                .style("left", (e.pageX + 15) + "px");
                        })
                        .on("mouseout", function() {
                            d3.select(this).attr("stroke", "#999").attr("stroke-width", 0.3);
                            tooltip.style("visibility", "hidden");
                        });

                    spikeLayerDist.style("display", "block").transition().style("opacity", 1);
                    
                    updateSpikes(); 
                });
        }

        function spikePath(x, y, h, w) { return `M${x - w/2},${y} L${x},${y - h} L${x + w/2},${y} Z`; }

        projection.fitSize([width, height], geoReg);

        // --- DISEGNO REGIONI ---
        regionLayer.selectAll("path").data(geoReg.features).join("path")
            .attr("d", path).attr("class", "region-feature")
            .attr("fill", "#e9ecef")
            .attr("stroke", "#fff").attr("stroke-width", 0.8)
            .attr("vector-effect", "non-scaling-stroke")
            .style("cursor", "pointer")
            .on("mouseover", function(event, d) {
                // FIX: Blocco durante il reset e se nascosto
                if (isResetting || d3.select(this).classed("hidden-totally")) return;
                
                d3.select(this).raise(); 
                
                d3.select(this)
                    .transition().duration(200)
                    .attr("stroke", "#000000") 
                    .attr("stroke-width", 2);
                
                // NESSUN TOOLTIP CON NOME (Solo bordo nero)
            })
            .on("mouseout", function() {
                if (this !== active.node()) {
                    d3.select(this)
                        .transition().duration(200)
                        .attr("stroke", "#fff")
                        .attr("stroke-width", 0.8);
                }
            })
            .on("click", clickedRegion);

        // Disegno layer distretti
        districtLayer.selectAll("path").data(geoDist.features).join("path")
            .attr("d", path).attr("class", "district-feature")
            .attr("fill", "transparent") 
            .attr("stroke", "#999")
            .attr("stroke-width", 0.3)
            .attr("vector-effect", "non-scaling-stroke")
            .style("pointer-events", "none"); 

        resetBtn.on("click", reset);
        backdrop.on("click", reset); 
        
        d3.selectAll("#check-battles, #check-explosions").on("change", updateSpikes);
        d3.select("#year-toggle").on("change", updateSpikes);
        d3.select("#year-slider").on("input", updateSpikes);

        updateSpikes();

    }).catch(err => console.error("Error:", err));

})();