(function() { 
    
    // --- 1. CONFIGURAZIONE ---
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
    const SPIKE_WIDTH = 8; // Larghezza base della spike

    // --- 2. HELPERS ---
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

    // --- 3. PULIZIA VECCHI ELEMENTI ---
    d3.select("#spike-controls").remove();

    // --- 4. SETUP SVG & ZOOM ---
    d3.select("#spike-container").style("position", "relative");
    const svg = d3.select("#spike-container")
        .attr("viewBox", [0, 0, width, height])
        .style("overflow", "hidden")
        .style("cursor", "move");

    svg.selectAll("*").remove();
    const g = svg.append("g");

    /* --- OLD LOGIC ZOOM ---
    // Inizializziamo lo zoom, ma definiremo il comportamento .on("zoom") dopo aver caricato i dati
    const zoom = d3.zoom().scaleExtent([1, 8]);
    svg.call(zoom);

    // --- BARRA ZOOM ---
    d3.select(".zoom-bar-spike").remove();
    const wrapper = d3.select("#spike-container").node().parentNode;
    d3.select(wrapper).style("position", "relative");

    const zoomBar = d3.select(wrapper).append("div")
        .attr("class", "zoom-bar zoom-bar-spike")
        .style("position", "absolute")
        .style("top", "20px")
        .style("right", "20px")
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("gap", "5px")
        .style("z-index", "100");

    zoomBar.append("button").attr("class", "zoom-btn").text("+").on("click", () => svg.transition().duration(500).call(zoom.scaleBy, 1.3));
    zoomBar.append("button").attr("class", "zoom-btn").text("−").on("click", () => svg.transition().duration(500).call(zoom.scaleBy, 0.7));
    zoomBar.append("button").attr("class", "zoom-btn").style("font-size","14px").text("Rst").on("click", () => svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity));
    */


    // --- ZOOM LOGIC (STANDARDIZZATA) ---
    // 1. Definisci lo zoom
    const zoom = d3.zoom()
        .scaleExtent([1, 8]) // Mantieni il limite che avevi per la spike map
        .on("zoom", (event) => {
            // Applica la trasformazione al gruppo che contiene la mappa/spike
            // Nota: Assicurati che 'mapGroup' o 'g' sia la variabile dove hai disegnato tutto
            // Se nel tuo codice usi 'g' o un altro nome, aggiorna qui sotto:
            svg.selectAll("g").attr("transform", event.transform); 
        });

    // 2. Collega lo zoom all'SVG e disabilita il doppio click
    svg.call(zoom).on("dblclick.zoom", null);

    // 3. Collega i bottoni HTML
    d3.select("#spike-zoom-in").on("click", () => svg.transition().duration(500).call(zoom.scaleBy, 1.3));
    d3.select("#spike-zoom-out").on("click", () => svg.transition().duration(500).call(zoom.scaleBy, 0.7));
    d3.select("#spike-zoom-reset").on("click", () => svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity));

    // --- TOOLTIP ---
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

    // --- CARICAMENTO DATI ---
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

        // --- Variabile per tracciare lo zoom corrente ---
        let currentK = 1; 

        // Geometrie
        const getGeo = (topo) => (topo && topo.type === "Topology") ? topojson.feature(topo, topo.objects[Object.keys(topo.objects)[0]]) : topo;
        const geoDist = getGeo(topoDist);
        const geoComuni = getGeo(geoComuniRaw);

        // Pulizia
        const clean = (d) => { d.fatalities = +d.fatalities || 0; if (d.latitude && d.longitude) { d.lat = +d.latitude; d.lon = +d.longitude; } };
        csvRegion.forEach(clean); csvDist.forEach(clean); csvComuni.forEach(clean);

        projection.fitSize([width, height], geoReg);

        // Centroidi
        const normalize = str => str ? String(str).toLowerCase().trim().replace(/['`’.]/g, "").replace(/\s+/g, " ") : "";
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

        // Disegno Base Mappa
        mapLayer.selectAll("path").data(geoReg.features).join("path")
            .attr("d", path).attr("fill", "#e9ecef").attr("stroke", "#fff").attr("stroke-width", 1.5)
            .on("mouseover", function(e, d) {
                d3.select(this).attr("fill", "#dee2e6");
                tooltip.style("visibility", "visible").html(`<div style="padding:6px 10px; font-weight:700; font-size:16px; color:#333;">${getCleanNameFromGeo(d.properties.NAME_1 || d.properties.name)}</div>`);
            })
            .on("mousemove", e => tooltip.style("top", (e.pageY-20)+"px").style("left", (e.pageX+20)+"px"))
            .on("mouseout", function() { d3.select(this).attr("fill", "#e9ecef"); tooltip.style("visibility", "hidden"); });

        // --- Helper per disegnare la Spike ---
        function spikePath(x, y, h, w) { return `M${x-w/2},${y} L${x},${y-h} L${x+w/2},${y} Z`; }
        function getHeight(val) { const h = lenScale(val); return (h < 2 && val === 0) ? 5 : h; }

        // --- GESTIONE ZOOM PROPORZIONALE ---
        // Definiamo il comportamento dello zoom QUI, dove abbiamo accesso ai dati e alle funzioni spike
        zoom.on("zoom", (event) => {
            currentK = event.transform.k; // Aggiorna il fattore di zoom
            
            // 1. Trasforma il contenitore mappa
            g.attr("transform", event.transform);
            
            // 2. Assottiglia i bordi dei distretti/regioni
            g.selectAll(".map-layer path").attr("stroke-width", 1.5 / currentK);

            // 3. Ridisegna le spike "al volo" per mantenerle sottili
            // Calcoliamo la nuova larghezza: Larghezza Base / Fattore Zoom
            const scaledWidth = SPIKE_WIDTH / currentK;

            spikeLayer.selectAll(".spike-group").each(function(d) {
                const h = getHeight(d.value);
                
                // Aggiorna parte visiva (triangolo rosso)
                d3.select(this).select(".spike-visual")
                    .attr("d", spikePath(d.x, d.y, h, scaledWidth));
                
                // Aggiorna hitbox (area invisibile cliccabile) - minimo 5px o scala proporzionale
                d3.select(this).select(".spike-hitbox")
                    .attr("d", spikePath(d.x, d.y, h < 25 ? 25 : h, Math.max(scaledWidth, 5/currentK))); 
            });
        });

        // --- Funzione Helper per aggiornare lo stile dei bottoni ---
        function updateControlStyles() {
            // Seleziona tutti gli input (radio e checkbox) dentro il menu
            d3.selectAll('#static-spike-controls input').each(function() {
                const isChecked = d3.select(this).property("checked");
                // Trova la label collegata a questo input tramite l'attributo "for"
                d3.select(`label[for="${this.id}"]`).classed("active", isChecked);
            });
        }

        // --- UPDATE FUNCTION ---
        function updateSpikes() {
            updateControlStyles(); // Aggiorna lo stile dei bottoni
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
                if (v.val > 0 || v.count > 0) {
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
            drawLegend(dMax);

            // Larghezza calcolata in base allo zoom attuale
            const currentSpikeWidth = SPIKE_WIDTH / currentK;

            const spikes = spikeLayer.selectAll(".spike-group").data(data, d => d.name);
            const exit = spikes.exit();
            exit.select(".spike-visual")
                .transition().duration(200)
                .attr("d", d => spikePath(d.x, d.y, 0, currentSpikeWidth)) // Si restringe usando width attuale
                .attr("fill-opacity", 0);
            exit.transition().duration(200).remove();

            const enter = spikes.enter().append("g").attr("class", "spike-group");
            enter.append("path").attr("class", "spike-visual")
                .attr("fill", "#dc3545").attr("stroke", "#8e0000").attr("stroke-width", 0.5).attr("fill-opacity", 0)
                .attr("d", d => spikePath(d.x, d.y, 0, currentSpikeWidth));
            enter.append("path").attr("class", "spike-hitbox")
                .attr("fill", "transparent").attr("stroke-width", 20).style("cursor", "pointer")
                .attr("d", d => spikePath(d.x, d.y, 0, currentSpikeWidth));

            const all = enter.merge(spikes);

            all.select(".spike-visual").transition().duration(600).ease(d3.easeCubicOut)
                .attr("fill-opacity", 0.85)
                .attr("d", d => spikePath(d.x, d.y, getHeight(d.value), currentSpikeWidth));

            all.select(".spike-hitbox")
                .attr("d", d => spikePath(d.x, d.y, getHeight(d.value) < 25 ? 25 : getHeight(d.value), currentSpikeWidth));

            all.on("mouseover", (e, d) => {
                d3.select(e.currentTarget).select(".spike-visual").attr("fill", "#a71d2a").attr("fill-opacity", 1);
                const b = d.details["Battles"] || 0; const ex = d.details["Explosions/Remote violence"] || 0;
                tooltip.style("visibility", "visible").html(`
                    <div style="border-bottom:2px solid #ddd; font-weight:800; margin-bottom:10px; padding-bottom:5px; font-size:18px; color:#222;">${d.name}</div>
                    <div style="display:flex; justify-content:space-between; font-size:15px; color:#333; margin-bottom:12px;"><span>Victims:</span> <strong>${d.value.toLocaleString()}</strong></div>
                    <svg width="260" height="50" style="background:#f0f0f0; border-radius:6px; margin-top:5px;">
                        <rect x="0" y="0" width="${(b/Math.max(b,ex,1))*100}%" height="25" fill="#007bff"></rect><text x="8" y="18" class="tooltip-bar-label">Bat: ${b}</text>
                        <rect x="0" y="25" width="${(ex/Math.max(b,ex,1))*100}%" height="25" fill="#dc3545"></rect><text x="8" y="43" class="tooltip-bar-label">Exp: ${ex}</text>
                    </svg>`);
            }).on("mousemove", e => tooltip.style("top", (e.pageY-20)+"px").style("left", (e.pageX+20)+"px"))
              .on("mouseout", (e) => { d3.select(e.currentTarget).select(".spike-visual").attr("fill", "#dc3545").attr("fill-opacity", 0.85); tooltip.style("visibility", "hidden"); });
        }

        function drawLegend(mx) {
            legendLayer.selectAll("*").remove();
            const lx = 30, ly = height - 110; 
            const g = legendLayer.append("g").attr("transform", `translate(${lx},${ly})`);
            const steps = [{l:"0-100",v:100}, {l:"1k-5k",v:5000}];
            if (mx > 7500) steps.push({l: d3.format(".1s")(mx), v: mx});
            let cx = 0;
            // La legenda NON deve scalare con lo zoom, usiamo SPIKE_WIDTH fisso
            steps.forEach(s => {
                if (s.v <= mx || (s.v===5000 && mx>=1000)) {
                    const h = lenScale(s.v) * 0.6; 
                    g.append("path").attr("d", spikePath(cx+10, 0, h, SPIKE_WIDTH)).attr("fill", "#dc3545").attr("stroke", "#8e0000").attr("stroke-width", 0.5);
                    g.append("text").attr("x", cx+20).attr("y", 0).text(s.l).attr("font-size", "12px").attr("fill", "#555").attr("font-family", "sans-serif").attr("font-weight", "600");
                    cx += 90;
                }
            });
            g.append("text").attr("x",0).attr("y",30).text("Victims (Spike height)").attr("font-size","14px").attr("font-weight","bold").attr("fill","#333").attr("font-family", "sans-serif");
        }

        // --- ASSEGNAZIONE EVENTI AI BOTTONI STATICI ---
        d3.selectAll('input[name="mapLevel"]').on("change", updateSpikes);
        d3.selectAll("#check-battles, #check-explosions").on("change", updateSpikes);
        
        // Prima chiamata per disegnare la mappa
        updateSpikes();


        // -- How to read the chart --
        const mapHelpContent = {
            title: "How to read the Map",
            steps: [
                "<strong>Colors:</strong> Darker red indicates a higher number of conflict events.",
                "<strong>Interaction:</strong> Hover over any country to see detailed statistics.",
                "<strong>Zoom:</strong> Click on a country to zoom in and explore regional data."
            ]
        };

        // Chiamo utils.js con i NUOVI parametri
        if (typeof createChartHelp === "function") {
            createChartHelp("#spike-help-container", "#spike-map-wrapper", mapHelpContent);
        } else {
            console.warn("createChartHelp non trovata.");
        }

    }).catch(e => console.error("CRITICAL ERROR:", e));
})();