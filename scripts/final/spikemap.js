
(function() { 
    
    // --- 1. CONFIGURAZIONE PERCORSI ---
    const PATHS = {
        geoRegion: "../../data/final/geojson/countries/UKR.json", 
        geoDistrict: "../../data/final/geojson/dinstrict/Ukraine_ADM2.topojson",
        geoComuni: "../../data/final/geojson/municipals/Ukraine_ADM3.topojson", 
        
        dataRegion: "../../data/final/spikemap_ukr_regioni.csv", 
        dataDistrict: "../../data/final/spikemap_ukr_province.csv",
        dataComuni: "../../data/final/spikemap_ukr_comuni.csv"
    };

    const width = 1000;
    const height = 650;
    const SPIKE_WIDTH = 8; 

    // --- 2. DIZIONARIO DI CORREZIONE ---
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

    // --- 3. SETUP INTERFACCIA ---
    d3.select("#back-button").remove();
    d3.select("#btn-back").remove();

    let controls = d3.select("#spike-controls");
    if (controls.empty()) {
        const svgNode = d3.select("#spike-container").node();
        if (svgNode && svgNode.parentNode) {
            d3.select(svgNode.parentNode)
              .insert("div", function() { return svgNode; })
              .attr("id", "spike-controls")
              .attr("class", "map-controls")
              .style("text-align", "center").style("margin-bottom", "20px");
            controls = d3.select("#spike-controls");
        }
    }
    
    // CREAZIONE CONTROLLI
    if (!controls.empty()) {
        controls.html(""); 
        const container = controls.append("div").attr("class", "spike-ui-container");

        // GRUPPO LIVELLO
        const grpLevel = container.append("div").attr("class", "ui-group");
        grpLevel.append("span").attr("class", "ui-label").text("Level");
        
        const toggleSwitch = grpLevel.append("div").attr("class", "toggle-switch");
        
        const lblReg = toggleSwitch.append("label").attr("class", "toggle-option");
        lblReg.append("input").attr("type", "radio").attr("name", "mapLevel").attr("value", "region");
        lblReg.append("span").text("Regions");

        const lblDist = toggleSwitch.append("label").attr("class", "toggle-option");
        lblDist.append("input").attr("type", "radio").attr("name", "mapLevel").attr("value", "district").property("checked", true);
        lblDist.append("span").text("Districts");

        const lblCom = toggleSwitch.append("label").attr("class", "toggle-option");
        lblCom.append("input").attr("type", "radio").attr("name", "mapLevel").attr("value", "comuni");
        lblCom.append("span").text("Municipals");

        // SEPARATORE
        container.append("div").attr("class", "ui-separator");

        // GRUPPO FILTRI
        const grpFilter = container.append("div").attr("class", "ui-group");
        grpFilter.append("span").attr("class", "ui-label").text("Filter");

        const lblBat = grpFilter.append("label").attr("class", "filter-chip");
        lblBat.append("input").attr("type", "checkbox").attr("id", "check-battles").property("checked", true);
        lblBat.append("span").attr("class", "chip-battles").html("Battles");

        const lblExp = grpFilter.append("label").attr("class", "filter-chip");
        lblExp.append("input").attr("type", "checkbox").attr("id", "check-explosions").property("checked", true);
        lblExp.append("span").attr("class", "chip-explosions").html("Explosions");
    }

    // --- 4. SETUP SVG ---
    const svg = d3.select("#spike-container").attr("viewBox", [0, 0, width, height]).style("overflow", "visible");
    svg.selectAll("*").remove();
    const g = svg.append("g");

    // Tooltip
    let tooltip = d3.select("body").select(".shared-tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div").attr("class", "shared-tooltip")
            .style("position", "absolute").style("visibility", "hidden")
            .style("background", "rgba(255, 255, 255, 0.98)").style("border", "1px solid #999")
            .style("padding", "18px").style("border-radius", "10px").style("font-family", "sans-serif").style("font-size", "16px")
            .style("pointer-events", "none").style("z-index", "10000").style("box-shadow", "0 10px 30px rgba(0,0,0,0.2)"); 
    }

    const projection = d3.geoConicConformal().rotate([-31, 0]).center([31.1656, 48.3794]);
    const path = d3.geoPath().projection(projection);
    const lenScale = d3.scaleSqrt().range([0, 180]); 

    const mapLayer = g.append("g").attr("class", "map-layer");
    const spikeLayer = g.append("g").attr("class", "spike-layer"); 
    const legendLayer = svg.append("g").attr("class", "legend-layer");

    const safeJson = (url) => d3.json(url).catch(e => { console.warn("Missing JSON:", url); return null; });
    const safeCsv = (url) => d3.csv(url).catch(e => { console.warn("Missing CSV:", url); return []; });

    console.log("Loading data...");

    Promise.all([
        d3.json(PATHS.geoRegion),
        d3.json(PATHS.geoDistrict), 
        safeJson(PATHS.geoComuni), 
        safeCsv(PATHS.dataRegion),
        d3.csv(PATHS.dataDistrict), 
        d3.csv(PATHS.dataComuni)
    ]).then(([geoReg, topoDist, geoComuniRaw, csvRegion, csvDist, csvComuni]) => {

        console.log("Data loaded.");

        // Geometrie
        const getGeo = (topo) => (topo && topo.type === "Topology") ? topojson.feature(topo, topo.objects[Object.keys(topo.objects)[0]]) : topo;
        const geoDist = getGeo(topoDist);
        const geoComuni = getGeo(geoComuniRaw);

        // Pulizia
        const clean = (d) => {
            d.fatalities = +d.fatalities || 0;
            if (d.latitude && d.longitude) { d.lat = +d.latitude; d.lon = +d.longitude; }
        };
        csvRegion.forEach(clean);
        csvDist.forEach(clean);
        csvComuni.forEach(clean);

        // Proiezione
        projection.fitSize([width, height], geoReg);

        // --- CALCOLO CENTROIDI ---
        const normalize = str => str ? String(str).toLowerCase().trim()
            .replace(/['`’.]/g, "")
            .replace(/\s+/g, " ") : "";

        const calculateCentroids = (features, data, nameFieldData, geoPropertyName) => {
            const centroidMap = new Map();
            if (!features || features.length === 0) return centroidMap;
            
            const uniqueNames = [...new Set(data.map(d => d[nameFieldData]))];
            
            features.forEach(f => {
                let geoName = "";
                if (geoPropertyName && f.properties[geoPropertyName]) {
                    geoName = f.properties[geoPropertyName];
                } else {
                    geoName = f.properties.shapeName || f.properties.NAME_1 || f.properties.NAME_2 || f.properties.NAME_3 || f.properties.name || "";
                }
                
                if (geoName) {
                    const normGeo = normalize(geoName);
                    
                    const match = uniqueNames.find(c => {
                        const normCsv = normalize(c);
                        if (NAME_MAPPING[normCsv]) {
                            return normGeo.includes(NAME_MAPPING[normCsv]);
                        }
                        if (normCsv === "kyiv" && normGeo.includes("city")) return false; 
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

        const regionCentroids = calculateCentroids(geoReg.features, csvRegion, "admin1", "NAME_1", "REGIONS");
        const distCentroids = calculateCentroids(geoDist ? geoDist.features : [], csvDist, "admin2", "NAME_2", "DISTRICTS");
        const comCentroids = calculateCentroids(geoComuni ? geoComuni.features : [], csvComuni, "admin3", "NAME_3", "COMUNI");

        // --- 5. DISEGNO MAPPA BASE (FISSO) ---
        mapLayer.selectAll("path")
            .data(geoReg.features)
            .join("path")
            .attr("d", path)
            .attr("fill", "#e9ecef")
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .on("mouseover", function(e, d) {
                d3.select(this).attr("fill", "#dee2e6");
                const name = d.properties.NAME_1 || d.properties.name || "Region";
                tooltip.style("visibility", "visible").html(`<div style="padding:4px 8px; font-weight:700; font-size:16px;">${name}</div>`);
            })
            .on("mousemove", e => tooltip.style("top", (e.pageY-20)+"px").style("left", (e.pageX+20)+"px"))
            .on("mouseout", function() { d3.select(this).attr("fill", "#e9ecef"); tooltip.style("visibility", "hidden"); });


        // --- 6. UPDATE FUNCTION (CON TRANSIZIONI FLUIDE) ---
        function updateSpikes() {
            const radioNode = d3.select('input[name="mapLevel"]:checked').node();
            const level = radioNode ? radioNode.value : "district";
            const showBat = d3.select("#check-battles").property("checked");
            const showExp = d3.select("#check-explosions").property("checked");

            let currentData, currentCentroids, labelName;
            
            if (level === "region") {
                currentData = csvRegion;
                currentCentroids = regionCentroids;
                labelName = "admin1";
            } else if (level === "district") {
                currentData = csvDist;
                currentCentroids = distCentroids;
                labelName = "admin2";
            } else {
                currentData = csvComuni;
                currentCentroids = comCentroids;
                labelName = "admin3";
                if (currentData.length && !currentData[0][labelName]) labelName = "location";
            }

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
                if (v.val > 0 || v.count > 0) {
                    let px, py;
                    if (v.lat && v.lon) {
                        const p = projection([v.lon, v.lat]);
                        if (p) [px, py] = p;
                    } else if (currentCentroids.has(k)) {
                        const c = currentCentroids.get(k);
                        [px, py] = c;
                    }
                    
                    if (px !== undefined) {
                        data.push({ name: k, value: v.val, count: v.count, details: v.dets, x: px, y: py });
                        if (v.val > maxVal) maxVal = v.val;
                    }
                }
            });

            // Disegno Spike con Animazione
            const dMax = Math.max(maxVal, 100);
            lenScale.domain([0, dMax]);
            drawLegend(dMax);

            const spikes = spikeLayer.selectAll(".spike-group").data(data, d => d.name);

            // --- EXIT: Rimpicciolisci e rimuovi ---
            const exit = spikes.exit();
            
            exit.select(".spike-visual")
                .transition().duration(100)
                .attr("d", d => spikePath(d.x, d.y, 0, SPIKE_WIDTH)) // Altezza 0
                .attr("fill-opacity", 0);

            exit.transition().duration(100).remove();

            // --- ENTER: Crea a zero e prepara ---
            const enter = spikes.enter().append("g").attr("class", "spike-group");
            
            enter.append("path").attr("class", "spike-visual")
                .attr("fill", "#dc3545").attr("stroke", "#8e0000").attr("stroke-width", 0.5)
                .attr("fill-opacity", 0) // Inizia invisibile
                .attr("d", d => spikePath(d.x, d.y, 0, SPIKE_WIDTH)); // Inizia piatto

            enter.append("path").attr("class", "spike-hitbox")
                .attr("fill", "transparent").attr("stroke-width", 20).style("cursor", "pointer")
                .attr("d", d => spikePath(d.x, d.y, 0, SPIKE_WIDTH)); // Hitbox segue

            // --- UPDATE: Unisci e Anima crescita ---
            const all = enter.merge(spikes);
            
            const getHeight = (val) => {
                const h = lenScale(val);
                return (h < 2 && val === 0) ? 5 : h;
            };

            all.select(".spike-visual")
                .transition().duration(600).ease(d3.easeCubicOut) // Transizione fluida
                .attr("fill-opacity", 0.85)
                .attr("d", d => spikePath(d.x, d.y, getHeight(d.value), SPIKE_WIDTH));
            
            all.select(".spike-hitbox")
                .attr("d", d => {
                    let h = getHeight(d.value);
                    return spikePath(d.x, d.y, h < 25 ? 25 : h, SPIKE_WIDTH);
                });

            // Tooltip (SENZA EVENTI)
            all.on("mouseover", (e, d) => {
                d3.select(e.currentTarget).select(".spike-visual").attr("fill", "#a71d2a").attr("fill-opacity", 1);
                const b = d.details["Battles"] || 0;
                const ex = d.details["Explosions/Remote violence"] || 0;
                const m = Math.max(b, ex, 1);
                
                tooltip.style("visibility", "visible").html(`
                    <div style="border-bottom:2px solid #ddd; font-weight:800; margin-bottom:10px; padding-bottom:5px; font-size:18px; color:#222;">
                        ${d.name}
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:15px; color:#333; margin-bottom:12px;">
                        <span>Victims:</span> <strong>${d.value.toLocaleString()}</strong>
                    </div>
                    <div style="font-size:12px; font-weight:600; color:#777; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">
                        Victims Type
                    </div>
                    <svg width="260" height="50" style="background:#f0f0f0; border-radius:6px; margin-top:5px;">
                        <rect x="0" y="0" width="${(b/m)*100}%" height="25" fill="#007bff"></rect>
                        <text x="8" y="18" class="tooltip-bar-label">Bat: ${b}</text>
                        <rect x="0" y="25" width="${(ex/m)*100}%" height="25" fill="#dc3545"></rect>
                        <text x="8" y="43" class="tooltip-bar-label">Exp: ${ex}</text>
                    </svg>
                `);
            }).on("mousemove", e => tooltip.style("top", (e.pageY-20)+"px").style("left", (e.pageX+20)+"px"))
              .on("mouseout", (e) => {
                  d3.select(e.currentTarget).select(".spike-visual").attr("fill", "#dc3545").attr("fill-opacity", 0.85);
                  tooltip.style("visibility", "hidden");
              });
        }

        function drawLegend(mx) {
            legendLayer.selectAll("*").remove();
            const lx = 30, ly = height - 60;
            const g = legendLayer.append("g").attr("transform", `translate(${lx},${ly})`);
            const steps = [{l:"0-100",v:100}, {l:"1k-5k",v:5000}];
            if (mx > 7500) steps.push({l: d3.format(".1s")(mx), v: mx});
            let cx = 0;
            steps.forEach(s => {
                if (s.v <= mx || (s.v===5000 && mx>=1000)) {
                    const h = lenScale(s.v);
                    g.append("path").attr("d", spikePath(cx+10, 0, h, SPIKE_WIDTH)).attr("fill", "#dc3545").attr("stroke", "#8e0000").attr("stroke-width", 0.5);
                    g.append("text").attr("x", cx+20).attr("y", 0).text(s.l).attr("font-size", "12px").attr("fill", "#555").attr("font-family", "sans-serif").attr("font-weight", "600");
                    cx += 90;
                }
            });
            g.append("text").attr("x",0).attr("y",30).text("Victims (Spike height)").attr("font-size","14px").attr("font-weight","bold").attr("fill","#333").attr("font-family", "sans-serif");
        }

        function spikePath(x, y, h, w) { return `M${x-w/2},${y} L${x},${y-h} L${x+w/2},${y} Z`; }

        // LISTENERS
        d3.selectAll('input[name="mapLevel"]').on("change", updateSpikes);
        d3.selectAll("#check-battles, #check-explosions").on("change", updateSpikes);
        updateSpikes();

    }).catch(e => console.error("CRITICAL ERROR:", e));
})();