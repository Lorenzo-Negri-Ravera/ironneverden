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

    const COLOR_BATTLES = "#ff6361";
    const COLOR_EXPLOSIONS = "#ffa600";

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
    
    // Contenitore per i gradienti (Definizioni SVG)
    const defs = svg.append("defs");
    const g = svg.append("g");

    const lenScale = d3.scaleSqrt().range([0, 180]); 

    const zoom = d3.zoom()
        .scaleExtent([1, 8]) 
        .translateExtent([[0, 0], [width, height]]) 
        .on("zoom", (event) => {
            const currentK = event.transform.k; 
            g.attr("transform", event.transform);
            g.selectAll(".map-layer path").attr("stroke-width", 1.5 / currentK);
            const scaledWidth = SPIKE_WIDTH / currentK;
            d3.select("#spike-container").selectAll(".spike-group").each(function(d) {
                const h = lenScale(d.value);
                d3.select(this).select(".spike-visual")
                    .attr("d", `M${d.x-scaledWidth/2},${d.y} L${d.x},${d.y-h} L${d.x+scaledWidth/2},${d.y} Z`);
                d3.select(this).select(".spike-hitbox")
                    .attr("d", `M${d.x-Math.max(scaledWidth, 5/currentK)/2},${d.y} L${d.x},${d.y-(h < 25 ? 25 : h)} L${d.x+Math.max(scaledWidth, 5/currentK)/2},${d.y} Z`); 
            });
        });

    svg.call(zoom).on("dblclick.zoom", null);

    const projection = d3.geoConicConformal().rotate([-31, 0]).center([31.1656, 48.3794]);
    const path = d3.geoPath().projection(projection);

    const mapLayer = g.append("g").attr("class", "map-layer");
    const spikeLayer = g.append("g").attr("class", "spike-layer"); 
    const legendLayer = svg.append("g").attr("class", "legend-layer");

    Promise.all([
        d3.json(PATHS.geoRegion),
        d3.json(PATHS.geoDistrict), 
        d3.json(PATHS.geoComuni).catch(() => null), 
        d3.csv(PATHS.dataRegion),
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

        const normalize = str => str ? String(str).toLowerCase().trim().replace(/['`’.]/g, "").replace(/\s+/g, " ") : "";
        const calculateCentroids = (features, data, nameFieldData, geoPropertyName) => {
            const centroidMap = new Map();
            if (!features) return centroidMap;
            const uniqueNames = [...new Set(data.map(d => d[nameFieldData]))];
            features.forEach(f => {
                let geoName = f.properties[geoPropertyName] || f.properties.shapeName || f.properties.NAME_1 || "";
                if (geoName) {
                    const match = uniqueNames.find(c => normalize(c) === normalize(geoName) || normalize(geoName).includes(normalize(c)));
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

        mapLayer.selectAll("path").data(geoReg.features).join("path")
            .attr("d", path).attr("fill", "#e9ecef").attr("stroke", "#fff").attr("stroke-width", 1.5);

        function spikePath(x, y, h, w) { return `M${x-w/2},${y} L${x},${y-h} L${x+w/2},${y} Z`; }

        function updateSpikes() {
            const radioNode = d3.select('input[name="mapLevel"]:checked').node();
            const level = radioNode ? radioNode.value : "district";
            const showBat = d3.select("#check-battles").property("checked");
            const showExp = d3.select("#check-explosions").property("checked");

            let currentData, currentCentroids, labelName;
            if (level === "region") { currentData = csvRegion; currentCentroids = regionCentroids; labelName = "admin1"; }
            else if (level === "district") { currentData = csvDist; currentCentroids = distCentroids; labelName = "admin2"; }
            else { currentData = csvComuni; currentCentroids = comCentroids; labelName = "admin3"; }

            const agg = new Map();
            let maxVal = 0;
            currentData.forEach(d => {
                let ok = false;
                if (d.event_type === "Battles" && showBat) ok = true;
                if (d.event_type === "Explosions/Remote violence" && showExp) ok = true;
                if (ok) {
                    const name = d[labelName] || "Unknown";
                    if (!agg.has(name)) agg.set(name, { val: 0, dets: {}, lat: d.lat, lon: d.lon });
                    const item = agg.get(name);
                    item.val += d.fatalities;
                    item.dets[d.event_type] = (item.dets[d.event_type] || 0) + d.fatalities;
                }
            });

            const data = [];
            agg.forEach((v, k) => {
                if (v.val > 0) {
                    let px, py;
                    if (v.lat && v.lon) { const p = projection([v.lon, v.lat]); if (p) [px, py] = p; }
                    else if (currentCentroids.has(k)) { const c = currentCentroids.get(k); [px, py] = c; }
                    
                    if (px !== undefined) {
                        const b = v.dets["Battles"] || 0;
                        const e = v.dets["Explosions/Remote violence"] || 0;
                        const total = b + e;
                        const pExp = (e / total) * 100; // Percentuale esplosioni

                        // Creazione ID gradiente univoco
                        const gradId = `grad-${k.replace(/\s+/g, '-')}`;
                        
                        let grad = defs.select(`#${gradId}`);
                        if (grad.empty()) grad = defs.append("linearGradient").attr("id", gradId).attr("x1", "0%").attr("y1", "100%").attr("x2", "0%").attr("y2", "0%");
                        
                        grad.selectAll("*").remove();
                        // Il gradiente va dal basso (y1=100%) verso l'alto (y2=0%)
                        // Disegniamo prima la parte esplosioni (gialla) poi battaglie (rossa)
                        grad.append("stop").attr("offset", "0%").attr("stop-color", COLOR_EXPLOSIONS);
                        grad.append("stop").attr("offset", `${pExp}%`).attr("stop-color", COLOR_EXPLOSIONS);
                        grad.append("stop").attr("offset", `${pExp}%`).attr("stop-color", COLOR_BATTLES);
                        grad.append("stop").attr("offset", "100%").attr("stop-color", COLOR_BATTLES);

                        data.push({ name: k, value: v.val, details: v.dets, x: px, y: py, gradId: gradId });
                        if (v.val > maxVal) maxVal = v.val;
                    }
                }
            });

            lenScale.domain([0, Math.max(maxVal, 100)]);
            const currentSpikeWidth = SPIKE_WIDTH / currentK;

            const spikes = spikeLayer.selectAll(".spike-group").data(data, d => d.name);
            spikes.exit().remove();

            const enter = spikes.enter().append("g").attr("class", "spike-group");
            enter.append("path").attr("class", "spike-visual").attr("stroke", "#333").attr("stroke-width", 0.2).attr("fill-opacity", 0.9);
            enter.append("path").attr("class", "spike-hitbox").attr("fill", "transparent").style("cursor", "pointer");

            const all = enter.merge(spikes);
            all.select(".spike-visual")
                .attr("fill", d => `url(#${d.gradId})`)
                .attr("d", d => spikePath(d.x, d.y, lenScale(d.value), currentSpikeWidth));

            all.select(".spike-hitbox")
                .attr("d", d => spikePath(d.x, d.y, Math.max(lenScale(d.value), 25), currentSpikeWidth));

            all.on("mouseover", (e, d) => {
                const b = d.details["Battles"] || 0;
                const ex = d.details["Explosions/Remote violence"] || 0;
                tooltip.style("visibility", "visible").html(`
                    <div style="font-weight:bold; border-bottom:1px solid #ccc; margin-bottom:5px;">${d.name}</div>
                    <div>Vittime Totali: <strong>${d.value}</strong></div>
                    <div style="color:${COLOR_BATTLES}">Battaglie: ${b}</div>
                    <div style="color:${COLOR_EXPLOSIONS}">Esplosioni: ${ex}</div>
                `);
            })
            .on("mousemove", (e) => tooltip.style("top", (e.pageY-10)+"px").style("left", (e.pageX+10)+"px"))
            .on("mouseout", () => tooltip.style("visibility", "hidden"));
        }

        d3.selectAll('input[name="mapLevel"], #check-battles, #check-explosions').on("change", updateSpikes);
        updateSpikes();

    }).catch(e => console.error(e));
})();