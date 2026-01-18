(function() { 
    
    // --- Configurations ---
    const PATHS = {
        geoRegion: "../../data/final/spike/region/UKR.json", 
        geoDistrict: "../../data/final/spike/district/Ukraine_ADM2.topojson",
        geoComuni: "../../data/final/spike/municipals/Ukraine_ADM3.topojson", 
        dataRegion: "../../data/final/spike/region/spikemap_ukr_region.csv", 
        dataDistrict: "../../data/final/spike/district/spikemap_ukr_province.csv",
        dataComuni: "../../data/final/spike/municipals/spikemap_ukr_municipal.csv"
    };
    const width = 1000;
    const height = 650;
    const SPIKE_WIDTH = 8; 

    // Colors
    const COLOR_BATTLES = "#dc3545"; // Rosso
    const COLOR_EXPLOSIONS = "#ffd700"; // Giallo
    const COLOR_STROKE = "#8e0000";

    // Regions name
    const NAME_MAPPING = {
        "vinnytsia": "vinnytska", "volyn": "volynska", "dnipropetrovsk": "dnipropetrovska",
        "donetsk": "donetska", "zhytomyr": "zhytomyrska", "zakarpattia": "zakarpatska",
        "zaporizhia": "zaporizka", "ivano-frankivsk": "ivano-frankivska",
        "kyiv": "kyivska", "kyiv city": "kyiv city", "kiev": "kyiv city",
        "kirovohrad": "kirovohradska", "luhansk": "luhanska", "lviv": "lvivska",
        "mykolaiv": "mykolaivska", "odesa": "odeska", "poltava": "poltavska",
        "rivne": "rivnenska", "sumy": "sumska", "ternopil": "ternopilska",
        "kharkiv": "kharkivska", "kherson": "khersonska", "khmelnytskyi": "khmelnytska",
        "cherkasy": "cherkaska", "chernivtsi": "chernivetska", "chernihiv": "chernihivska",
        "crimea": "krym"
    };

    const capitalize = (s) => s && s[0].toUpperCase() + s.slice(1);
    const getCleanNameFromGeo = (geoName) => {
        if (!geoName) return "Region";
        const lowerGeo = geoName.toLowerCase();
        const foundKey = Object.keys(NAME_MAPPING).find(key => lowerGeo.includes(NAME_MAPPING[key]));
        if (foundKey) return foundKey.split(/[\s-]/).map(capitalize).join(foundKey.includes("-") ? "-" : " ");
        return geoName;
    };

    d3.select("#spike-controls").remove();
    d3.select("#spike-container").style("position", "relative");
    
    const svg = d3.select("#spike-container")
        .attr("viewBox", [0, 0, width, height])
        .style("overflow", "hidden")
        .style("cursor", "move");

    svg.selectAll("*").remove();
    
    // Aggiungi definizione gradiente
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
        .attr("id", "spikeGradient")
        .attr("x1", "0%")
        .attr("y1", "100%")
        .attr("x2", "0%")
        .attr("y2", "0%");
    
    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", COLOR_EXPLOSIONS);
    
    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", COLOR_BATTLES);

    const g = svg.append("g");

    const lenScale = d3.scaleSqrt().range([0, 180]); 

    // --- Zoom Logic ---
    const zoom = d3.zoom()
        .scaleExtent([1, 8]) 
        .translateExtent([[0, 0], [width, height]]) 
        .on("zoom", (event) => {
            const currentK = event.transform.k; 
            g.attr("transform", event.transform);
            g.selectAll(".map-layer path").attr("stroke-width", 1.5 / currentK);
            const scaledWidth = SPIKE_WIDTH / currentK;
            d3.select("#spike-container").selectAll(".spike-group").each(function(d) {
                const val = d.value; 
                const h = (lenScale(val) < 2 && val === 0) ? 5 : lenScale(val);
                d3.select(this).select(".spike-visual")
                    .attr("d", `M${d.x-scaledWidth/2},${d.y} L${d.x},${d.y-h} L${d.x+scaledWidth/2},${d.y} Z`);
                d3.select(this).select(".spike-hitbox")
                    .attr("d", `M${d.x-Math.max(scaledWidth, 5/currentK)/2},${d.y} L${d.x},${d.y-(h < 25 ? 25 : h)} L${d.x+Math.max(scaledWidth, 5/currentK)/2},${d.y} Z`); 
            });
        });

    svg.call(zoom).on("dblclick.zoom", null);

    d3.select("#spike-zoom-in").on("click", () => svg.transition().duration(500).call(zoom.scaleBy, 1.3));
    d3.select("#spike-zoom-out").on("click", () => svg.transition().duration(500).call(zoom.scaleBy, 0.7));
    d3.select("#spike-zoom-reset").on("click", () => svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity));

    // --- Tooltip (COMPACT STYLE) ---
    let tooltip = d3.select("body").select(".shared-tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div").attr("class", "shared-tooltip")
            .style("position", "absolute").style("visibility", "hidden")
            .style("background", "rgba(255, 255, 255, 0.96)")
            .style("border", "1px solid #ccc") 
            .style("padding", "8px 10px") 
            .style("border-radius", "4px") 
            .style("font-family", "sans-serif").style("font-size", "12px")
            .style("pointer-events", "none").style("z-index", "10000")
            .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)");
    }

    const projection = d3.geoConicConformal().rotate([-31, 0]).center([31.1656, 48.3794]);
    const path = d3.geoPath().projection(projection);

    const mapLayer = g.append("g").attr("class", "map-layer");
    const spikeLayer = g.append("g").attr("class", "spike-layer"); 
    const legendLayer = svg.append("g").attr("class", "legend-layer");

    const safeJson = (url) => d3.json(url).catch(e => { console.warn("Missing JSON:", url); return null; });
    const safeCsv = (url) => d3.csv(url).catch(e => { console.warn("Missing CSV:", url); return []; });

    Promise.all([
        d3.json(PATHS.geoRegion),
        d3.json(PATHS.geoDistrict), 
        safeJson(PATHS.geoComuni), 
        safeCsv(PATHS.dataRegion),
        d3.csv(PATHS.dataDistrict), 
        d3.csv(PATHS.dataComuni)
    ]).then(([geoReg, topoDist, geoComuniRaw, csvRegion, csvDist, csvComuni]) => {

        let currentK = 1; 
        const getGeo = (topo) => (topo && topo.type === "Topology") ? topojson.feature(topo, topo.objects[Object.keys(topo.objects)[0]]) : topo;
        const geoDist = getGeo(topoDist);
        const geoComuni = getGeo(geoComuniRaw);

        const clean = (d) => { d.fatalities = +d.fatalities || 0; if (d.latitude && d.longitude) { d.lat = +d.latitude; d.lon = +d.longitude; } };
        csvRegion.forEach(clean); csvDist.forEach(clean); csvComuni.forEach(clean);

        projection.fitSize([width, height], geoReg);

        const normalize = str => str ? String(str).toLowerCase().trim().replace(/['`'.]/g, "").replace(/\s+/g, " ") : "";
        const calculateCentroids = (features, data, nameFieldData, geoPropertyName) => {
            const centroidMap = new Map();
            if (!features || features.length === 0) return centroidMap;
            const uniqueNames = [...new Set(data.map(d => d[nameFieldData]))];
            features.forEach(f => {
                let geoName = f.properties[geoPropertyName] || f.properties.shapeName || f.properties.NAME_1 || f.properties.NAME_2 || f.properties.NAME_3 || f.properties.name || "";
                if (geoName) {
                    const normGeo = normalize(geoName);
                    const match = uniqueNames.find(c => {
                        const normCsv = normalize(c);
                        if (NAME_MAPPING[normCsv]) return normGeo.includes(NAME_MAPPING[normCsv]);
                        if (normCsv === "kyiv" && normGeo.includes("city")) return false; 
                        if (normCsv === "kyiv city" && !normGeo.includes("city")) return false;
                        return normCsv === normGeo || normGeo.includes(normCsv) || normCsv.includes(normGeo);
                    });
                    if (match) {
                        const c = path.centroid(f);
                        if (!isNaN(c[0])) centroidMap.set(match, c);
                    }
                }
            });
            return centroidMap;
        };

        const regionCentroids = calculateCentroids(geoReg.features, csvRegion, "admin1", "NAME_1");
        const distCentroids = calculateCentroids(geoDist ? geoDist.features : [], csvDist, "admin2", "NAME_2");
        const comCentroids = calculateCentroids(geoComuni ? geoComuni.features : [], csvComuni, "admin3", "NAME_3");

        // --- MAP LAYER ---
        mapLayer.selectAll("path").data(geoReg.features).join("path")
            .attr("d", path).attr("fill", "#e9ecef").attr("stroke", "#fff").attr("stroke-width", 1.5)
            .on("mouseover", function(e, d) {
                d3.select(this).attr("fill", "#dee2e6");
                tooltip.style("visibility", "visible")
                    .html(`<div style="font-weight:700; font-size:13px; color:#222;">${getCleanNameFromGeo(d.properties.NAME_1 || d.properties.name)}</div>`);
            })
            .on("mousemove", e => tooltip.style("top", (e.pageY-15)+"px").style("left", (e.pageX+15)+"px"))
            .on("mouseout", function() { d3.select(this).attr("fill", "#e9ecef"); tooltip.style("visibility", "hidden"); });

        function spikePath(x, y, h, w) { return `M${x-w/2},${y} L${x},${y-h} L${x+w/2},${y} Z`; }
        function getHeight(val) { const h = lenScale(val); return (h < 2 && val === 0) ? 5 : h; }

        zoom.on("zoom", (event) => {
            currentK = event.transform.k; 
            g.attr("transform", event.transform);
            g.selectAll(".map-layer path").attr("stroke-width", 1.5 / currentK);
            const scaledWidth = SPIKE_WIDTH / currentK;
            spikeLayer.selectAll(".spike-group").each(function(d) {
                const h = getHeight(d.value);
                d3.select(this).select(".spike-visual").attr("d", spikePath(d.x, d.y, h, scaledWidth));
                d3.select(this).select(".spike-hitbox").attr("d", spikePath(d.x, d.y, h < 25 ? 25 : h, Math.max(scaledWidth, 5/currentK))); 
            });
        });

        // Aggiungi stili ai bottoni con colori
        function updateControlStyles() {
            const batCheck = d3.select("#check-battles");
            const expCheck = d3.select("#check-explosions");
            
            const batLabel = d3.select('label[for="check-battles"]');
            const expLabel = d3.select('label[for="check-explosions"]');
            
            if (batCheck.property("checked")) {
                batLabel.style("background", `linear-gradient(90deg, ${COLOR_BATTLES} 0%, ${COLOR_BATTLES} 20px, rgba(220, 53, 69, 0.1) 20px)`);
                batLabel.style("border-left", `4px solid ${COLOR_BATTLES}`);
                batLabel.style("font-weight", "600");
            } else {
                batLabel.style("background", "");
                batLabel.style("border-left", "");
                batLabel.style("font-weight", "normal");
            }
            
            if (expCheck.property("checked")) {
                expLabel.style("background", `linear-gradient(90deg, ${COLOR_EXPLOSIONS} 0%, ${COLOR_EXPLOSIONS} 20px, rgba(255, 215, 0, 0.1) 20px)`);
                expLabel.style("border-left", `4px solid ${COLOR_EXPLOSIONS}`);
                expLabel.style("font-weight", "600");
            } else {
                expLabel.style("background", "");
                expLabel.style("border-left", "");
                expLabel.style("font-weight", "normal");
            }
            
            // Stili per i radio buttons dei livelli (region, district, municipals)
            d3.selectAll('input[name="mapLevel"]').each(function() {
                const radio = d3.select(this);
                const label = d3.select(`label[for="${this.id}"]`);
                
                if (radio.property("checked")) {
                    label.style("font-weight", "bold");
                    label.style("color", "#000");
                    label.style("opacity", "1");
                } else {
                    label.style("font-weight", "normal");
                    label.style("color", "#666");
                    label.style("opacity", "0.6");
                }
            });
        }

        function createSharpGradient(id, battlesPerc) {
            // Rimuovi gradiente esistente se presente
            defs.select(`#${id}`).remove();
            
            // Crea nuovo gradiente con cambio netto
            const grad = defs.append("linearGradient")
                .attr("id", id)
                .attr("x1", "0%")
                .attr("y1", "100%")
                .attr("x2", "0%")
                .attr("y2", "0%");
            
            // Stop esplosioni (giallo in basso)
            grad.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", COLOR_EXPLOSIONS);
            
            // Cambio netto al punto di transizione
            grad.append("stop")
                .attr("offset", battlesPerc + "%")
                .attr("stop-color", COLOR_EXPLOSIONS);
            
            grad.append("stop")
                .attr("offset", battlesPerc + "%")
                .attr("stop-color", COLOR_BATTLES);
            
            // Stop battles (rosso in alto)
            grad.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", COLOR_BATTLES);
            
            return `url(#${id})`;
        }

        function getSpikeColor(d, showBat, showExp) {
            const b = d.details["Battles"] || 0;
            const ex = d.details["Explosions/Remote violence"] || 0;
            
            if (showBat && showExp && b > 0 && ex > 0) {
                // Modalità gradient con cambio netto
                const total = b + ex;
                const explosionsPerc = (ex / total) * 100;
                const gradientId = `gradient-${d.name.replace(/\s+/g, '-')}`;
                return createSharpGradient(gradientId, explosionsPerc);
            } else if (showBat && b > 0) {
                return COLOR_BATTLES;
            } else if (showExp && ex > 0) {
                return COLOR_EXPLOSIONS;
            }
            return COLOR_BATTLES;
        }

        function updateSpikes() {
            updateControlStyles(); 
            const radioNode = d3.select('input[name="mapLevel"]:checked').node();
            const level = radioNode ? radioNode.value : "district";
            const showBat = d3.select("#check-battles").property("checked");
            const showExp = d3.select("#check-explosions").property("checked");

            let currentData, currentCentroids, labelName;
            if (level === "region") { currentData = csvRegion; currentCentroids = regionCentroids; labelName = "admin1"; }
            else if (level === "district") { currentData = csvDist; currentCentroids = distCentroids; labelName = "admin2"; }
            else { currentData = csvComuni; currentCentroids = comCentroids; labelName = "admin3"; if (currentData.length && !currentData[0][labelName]) labelName = "location"; }

            const agg = new Map();
            let maxVal = 0;
            if (currentData) {
                currentData.forEach(d => {
                    let ok = false;
                    if (d.event_type === "Battles" && showBat) ok = true;
                    if (d.event_type === "Explosions/Remote violence" && showExp) ok = true;
                    if (ok) {
                        const name = d[labelName] || "Unknown";
                        if (!agg.has(name)) agg.set(name, { val: 0, count: 0, dets: {}, lat: d.lat, lon: d.lon });
                        const item = agg.get(name);
                        item.val += d.fatalities;
                        item.count++;
                        item.dets[d.event_type] = (item.dets[d.event_type] || 0) + d.fatalities;
                    }
                });
            }

            const data = [];
            agg.forEach((v, k) => {
                // Verifica che ci sia almeno un evento del tipo selezionato
                const b = v.dets["Battles"] || 0;
                const ex = v.dets["Explosions/Remote violence"] || 0;
                
                let shouldInclude = false;
                if (showBat && b > 0) shouldInclude = true;
                if (showExp && ex > 0) shouldInclude = true;
                
                if (shouldInclude && (v.val > 0 || v.count > 0)) {
                    let px, py;
                    if (v.lat && v.lon) { const p = projection([v.lon, v.lat]); if (p) [px, py] = p; }
                    else if (currentCentroids.has(k)) { const c = currentCentroids.get(k); [px, py] = c; }
                    if (px !== undefined) {
                        data.push({ name: k, value: v.val, count: v.count, details: v.dets, x: px, y: py });
                        if (v.val > maxVal) maxVal = v.val;
                    }
                }
            });

            const dMax = Math.max(maxVal, 100);
            lenScale.domain([0, dMax]);
            drawLegend(dMax, showBat, showExp);

            const currentSpikeWidth = SPIKE_WIDTH / currentK;
            const spikes = spikeLayer.selectAll(".spike-group").data(data, d => d.name);
            const exit = spikes.exit();
            exit.select(".spike-visual").transition().duration(200).attr("d", d => spikePath(d.x, d.y, 0, currentSpikeWidth)).attr("fill-opacity", 0);
            exit.transition().duration(200).remove();

            const enter = spikes.enter().append("g").attr("class", "spike-group");
            enter.append("path").attr("class", "spike-visual")
                .attr("stroke", COLOR_STROKE).attr("stroke-width", 0.5).attr("fill-opacity", 0)
                .attr("d", d => spikePath(d.x, d.y, 0, currentSpikeWidth));
            enter.append("path").attr("class", "spike-hitbox")
                .attr("fill", "transparent").attr("stroke-width", 20).style("cursor", "pointer")
                .attr("d", d => spikePath(d.x, d.y, 0, currentSpikeWidth));

            const all = enter.merge(spikes);

            all.each(function(d) {
                const spikeColor = getSpikeColor(d, showBat, showExp);
                
                d3.select(this).select(".spike-visual")
                    .attr("fill", spikeColor)
                    .transition().duration(1200).ease(d3.easeCubicInOut)
                    .attr("fill-opacity", 0.85)
                    .attr("d", spikePath(d.x, d.y, getHeight(d.value), currentSpikeWidth));
            });

            all.select(".spike-hitbox")
                .attr("d", d => spikePath(d.x, d.y, getHeight(d.value) < 25 ? 25 : getHeight(d.value), currentSpikeWidth));
            
            // --- SPIKE TOOLTIP ---
            all.on("mouseover", (e, d) => {
                const b = d.details["Battles"] || 0; 
                const ex = d.details["Explosions/Remote violence"] || 0;
                const total = d.value || 1; 
                
                const bPerc = ((b / total) * 100).toFixed(1);
                const exPerc = ((ex / total) * 100).toFixed(1);

                const maxVal = Math.max(b, ex, 1);
                
                tooltip.style("visibility", "visible").html(`
                    <div style="border-bottom: 1px solid #ddd; font-weight: 700; margin-bottom: 8px; padding-bottom: 4px; font-size: 14px; color: #222;">
                        ${d.name}
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size:12px;">
                        <span style="color: #444;">Total Victims:</span> 
                        <strong style="color: #000;">${d.value.toLocaleString()}</strong>
                    </div>

                    <svg width="220" height="45" style="background: #fafafa; border: 1px solid #eee; border-radius: 4px;">
                        <rect x="0" y="0" width="${(b/maxVal)*100}%" height="18" fill="${COLOR_BATTLES}" fill-opacity="0.3"></rect>
                        <rect x="0" y="0" width="3" height="18" fill="${COLOR_BATTLES}"></rect> 
                        <text x="6" y="13" style="font-size: 11px; font-weight: 600; fill: #222; font-family: sans-serif; pointer-events: none;">
                            Bat: ${b.toLocaleString()} (${bPerc}%)
                        </text>

                        <rect x="0" y="22" width="${(ex/maxVal)*100}%" height="18" fill="${COLOR_EXPLOSIONS}" fill-opacity="0.3"></rect>
                        <rect x="0" y="22" width="3" height="18" fill="${COLOR_EXPLOSIONS}"></rect>
                        <text x="6" y="35" style="font-size: 11px; font-weight: 600; fill: #222; font-family: sans-serif; pointer-events: none;">
                            Exp: ${ex.toLocaleString()} (${exPerc}%)
                        </text>
                    </svg>
                `);
            })
            .on("mousemove", (e) => {
                tooltip.style("top", (e.pageY - 15) + "px").style("left", (e.pageX + 15) + "px");
            })
            .on("mouseout", (e) => {
                tooltip.style("visibility", "hidden");
            });
        }

        function drawLegend(mx, showBat, showExp) {
            legendLayer.selectAll("*").remove();
            const lx = 30, ly = height - 40;
            const g = legendLayer.append("g").attr("transform", `translate(${lx},${ly})`);
            
            const steps = [{l:"0-100",v:100}, {l:"1k-5k",v:5000}];
            if (mx > 7500) steps.push({l: d3.format(".1s")(mx), v: mx});
            
            let cx = 0;
            steps.forEach(s => {
                if (s.v <= mx || (s.v===5000 && mx>=1000)) {
                    const h = lenScale(s.v) * 0.5; 
                    
                    let fillColor;
                    if (showBat && showExp) {
                        // Crea gradiente di esempio per la legenda (50/50)
                        const legendGradId = `legend-gradient-${s.v}`;
                        fillColor = createSharpGradient(legendGradId, 50);
                    } else if (showBat) {
                        fillColor = COLOR_BATTLES;
                    } else if (showExp) {
                        fillColor = COLOR_EXPLOSIONS;
                    } else {
                        fillColor = COLOR_BATTLES;
                    }
                    
                    g.append("path")
                        .attr("d", spikePath(cx+5, 0, h, SPIKE_WIDTH))
                        .attr("fill", fillColor).attr("stroke", COLOR_STROKE).attr("stroke-width", 0.5);
                    
                    g.append("text")
                        .attr("x", cx+12)
                        .attr("y", 0)
                        .text(s.l)
                        .attr("font-size", "11px")
                        .attr("fill", "#555")
                        .attr("font-family", "sans-serif")
                        .attr("font-weight", "600");
                    
                    cx += 60;
                }
            });

            g.append("text")
                .attr("x", 0)
                .attr("y", 20)
                .text("Victims (Spike height)")
                .attr("font-size", "11px")
                .attr("font-weight", "bold")
                .attr("fill", "#333")
                .attr("font-family", "sans-serif");
        }

        d3.selectAll('input[name="mapLevel"]').on("change", updateSpikes);
        d3.selectAll("#check-battles, #check-explosions").on("change", updateSpikes);
        
        updateSpikes();

        const mapHelpContent = {
            title: "How to read the Map",
            steps: [
                "<strong>Colors:</strong> Red spikes = Battles, Yellow spikes = Explosions. When both are selected, gradient shows proportion.",
                "<strong>Interaction:</strong> Hover over spikes to see detailed statistics.",
                "<strong>Zoom:</strong> Use zoom controls or drag to explore the map."
            ]
        };

        if (typeof createChartHelp === "function") {
            createChartHelp("#spike-help-container", "#spike-map-wrapper", mapHelpContent);
        } else {
            console.warn("createChartHelp non trovata.");
        }

    }).catch(e => console.error("CRITICAL ERROR:", e));
})();