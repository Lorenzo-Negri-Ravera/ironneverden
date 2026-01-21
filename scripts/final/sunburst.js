// File: sunburst.js

(function() {

    // --- CONFIGURAZIONE PATH ---
    const DATA_PATHS = {
        UKR_2021: "../../data/final/trade-data/final_datasets/UKR_export_2021_destinations.json",
        UKR_2023: "../../data/final/trade-data/final_datasets/UKR_export_2023_destinations.json",
        RUS_2021: "../../data/final/trade-data/final_datasets/RUS_export_2021_destinations.json",
        RUS_2023: "../../data/final/trade-data/final_datasets/RUS_export_2023_destinations.json"
    };

    // --- CONFIGURAZIONE VISIVA ---
    // Usiamo una dimensione logica interna quadrata. 
    // Il CSS lo scalerà, quindi 600 è solo per la risoluzione del viewBox.
    const width = 600; 
    const radius = width / 6;

    const continentColors = {
        "Europe": "#4e79a7",   
        "Asia": "#e15759",     
        "Africa": "#f28e2b",   
        "North America": "#76b7b2", 
        "South America": "#59a14f", 
        "Oceania": "#edc948",  
        "Unknown": "#bab0ac"   
    };

    const formatMoney = d3.format("$.2s"); 

    let allData = {};
    let currentCountry = "UKR"; 

    // --- 1. OBSERVER INTERNO ---
    document.addEventListener("DOMContentLoaded", function() {
        const target = document.querySelector("#sunburst-section");
        if(target) {
            const observer = new IntersectionObserver((entries, obs) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        initSunburst();
                        obs.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1 });
            observer.observe(target);
        }
    });

    // --- 2. INIT FUNCTION ---
    function initSunburst() {
        const wrapper = d3.select("#sunburst-wrapper");
        wrapper.selectAll(".chart-loader-overlay").remove();
        
        // Loader posizionato relativo al wrapper
        const loader = wrapper.append("div")
            .attr("class", "chart-loader-overlay")
            .style("display", "flex");
        loader.append("div").attr("class", "loader-spinner");

        const hideLoader = () => loader.style("display", "none");

        Promise.all([
            d3.json(DATA_PATHS.UKR_2021),
            d3.json(DATA_PATHS.UKR_2023),
            d3.json(DATA_PATHS.RUS_2021),
            d3.json(DATA_PATHS.RUS_2023)
        ]).then(([ukr21, ukr23, rus21, rus23]) => {

            allData = {
                UKR: { 2021: processHierarchy(ukr21), 2023: processHierarchy(ukr23) },
                RUS: { 2021: processHierarchy(rus21), 2023: processHierarchy(rus23) }
            };

            setupControls();
            updateDashboard();
            hideLoader();

        }).catch(err => {
            console.error("Errore Sunburst:", err);
            loader.html(`<div style="color:red">Error loading data</div>`);
        });
    }

    /*
    function processHierarchy(flatData) {
        const grouped = d3.group(flatData, d => d.Continent);
        const children = Array.from(grouped, ([key, values]) => {
            return {
                name: key,
                children: values.map(d => ({
                    name: d.Country,
                    value: d["Trade Value"]
                }))
            };
        });
        return { name: "World", children: children };
    }*/

    function processHierarchy(flatData) {
        // 1. Raggruppa per Continente
        const grouped = d3.group(flatData, d => d.Continent);
        
        // SOGLIA DI VISIBILITÀ CUMULATIVA (0.90 = 90%)
        // Mostriamo i paesi che costituiscono il 90% del business.
        // Il restante 10% (la coda degli "ultimissimi") finisce in Other.
        // Puoi alzare a 0.95 se vuoi accorpare ancora meno roba (solo l'ultimo 5%).
        const CUMULATIVE_CUTOFF = 0.90; 

        const children = Array.from(grouped, ([continentName, values]) => {
            
            const continentTotal = d3.sum(values, d => d["Trade Value"]);
            
            // IMPORTANTE: Ordiniamo decrescente per calcolare la cumulata
            values.sort((a, b) => b["Trade Value"] - a["Trade Value"]);

            let bigCountries = [];
            let otherValue = 0;
            let accumulatedPercent = 0;

            values.forEach(d => {
                const val = d["Trade Value"];
                const ratio = val / continentTotal;
                
                // Se non abbiamo ancora coperto il 90% del totale del continente...
                if (accumulatedPercent < CUMULATIVE_CUTOFF) {
                    // ...aggiungiamo il paese al grafico
                    bigCountries.push({
                        name: d.Country,
                        value: val
                    });
                    accumulatedPercent += ratio;
                } else {
                    // Siamo oltre il 90%, questi sono gli "ultimissimi": accorpa!
                    otherValue += val;
                }
            });

            // Aggiungi il blocco "Other" solo se esiste
            if (otherValue > 0) {
                bigCountries.push({
                    name: "Other", 
                    value: otherValue
                });
            }

            return {
                name: continentName,
                children: bigCountries
            };
        });

        return { name: "World", children: children };
    }

    // --- 3. CONTROLS SETUP ---
    function setupControls() {
        const container = d3.select("#sunburst-controls");
        if(container.empty()) return;

        container.attr("class", "compact-menu-bar d-inline-flex align-items-center");
        container.html("");

        const options = [
            { label: "Ukraine", value: "UKR" },
            { label: "Russia", value: "RUS" }
        ];

        options.forEach((opt, index) => {
            const btn = container.append("button")
                .attr("class", "btn-compact")
                .text(opt.label)
                .on("click", function() {
                    container.selectAll(".btn-compact").classed("active", false);
                    d3.select(this).classed("active", true);
                    currentCountry = opt.value;
                    updateDashboard();
                });

            if (opt.value === currentCountry) btn.classed("active", true);
            if (index < options.length - 1) container.append("div").attr("class", "compact-divider");
        });
    }

    // --- 4. DASHBOARD UPDATE ---
    function updateDashboard() {
        d3.select("#chart-2021").selectAll("*").remove();
        d3.select("#chart-2023").selectAll("*").remove();

        createZoomableSunburst(allData[currentCountry][2021], "#chart-2021", "#total-label-2021");
        createZoomableSunburst(allData[currentCountry][2023], "#chart-2023", "#total-label-2023");
    }

    // --- 5. CHART RENDERER ---
    function createZoomableSunburst(data, selector, labelSelector) {
        const root = d3.hierarchy(data)
            .sum(d => d.value)
            .sort((a, b) => {
                // REGOLA SPECIALE: "Other" deve sempre andare in fondo (dopo tutti gli altri)
                if (a.data.name === "Other") return 1; // Sposta 'a' (Other) verso la fine dell'ordinamento visivo
                if (b.data.name === "Other") return -1;  // Sposta 'b' (Other) verso la fine
                
                // Per tutti gli altri paesi, usa il normale ordinamento per valore decrescente
                return b.value - a.value;
            });

        d3.partition().size([2 * Math.PI, root.height + 1])(root);
        root.each(d => d.current = d);

        // Update Label
        const totalValue = root.value;
        const formattedTotal = totalValue ? formatMoney(totalValue).replace("G", "B") : "$0";
        d3.select(labelSelector).text(`Total Export: ${formattedTotal}`);

        const color = d3.scaleOrdinal()
            .domain(Object.keys(continentColors))
            .range(Object.values(continentColors));

        const arc = d3.arc()
            .startAngle(d => d.x0)
            .endAngle(d => d.x1)
            .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
            .padRadius(radius * 1.5)
            .innerRadius(d => d.y0 * radius)
            .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));

        // SVG CREATION:
        // Qui sta il trucco: NESSUN width/height in px. Solo viewBox.
        // Il CSS .chart-container-responsive farà width: 100%.
        const svg = d3.select(selector).append("svg")
            .attr("viewBox", [-width / 2, -width / 2, width, width]) 
            .style("font-family", "'Fira Sans', sans-serif")
            .style("font-size", "10px");
        
        // Rimuoviamo stili inline che bloccano la responsività (tipo max-width, display block manuali)
        // Il contenitore HTML padre gestisce la larghezza.

        const path = svg.append("g")
            .selectAll("path")
            .data(root.descendants().slice(1))
            .join("path")
            .attr("fill", d => {
                let currentNode = d;
                while (currentNode.depth > 1) currentNode = currentNode.parent;
                return color(currentNode.data.name) || "#ccc";
            })
            .attr("fill-opacity", d => arcVisible(d.current) ? (d.children ? 0.8 : 0.6) : 0)
            .attr("pointer-events", d => arcVisible(d.current) ? "auto" : "none")
            .attr("d", d => arc(d.current));

        path.filter(d => d.children)
            .style("cursor", "pointer")
            .on("click", clicked);

        path.append("title")
            .text(d => `${d.ancestors().map(d => d.data.name).reverse().join("/")}\n${formatMoney(d.value)}`);

        const label = svg.append("g")
            .attr("pointer-events", "none")
            .attr("text-anchor", "middle")
            .style("user-select", "none")
            .selectAll("text")
            .data(root.descendants().slice(1))
            .join("text")
            .attr("dy", "0.35em")
            .attr("fill-opacity", d => +labelVisible(d.current))
            .attr("transform", d => labelTransform(d.current))
            .text(d => d.data.name)
            .each(function(d) {
                try {
                    const self = d3.select(this);
                    const textLength = self.node().getComputedTextLength();
                    const availableSpace = (d.current.y1 - d.current.y0) * radius; 
                    if (d.current && textLength > availableSpace * 1.5) {
                        self.text(d.data.name.substring(0, 4) + "..");
                    }
                } catch(e) {}
            });

        const parent = svg.append("circle")
            .datum(root)
            .attr("r", radius)
            .attr("fill", "none")
            .attr("pointer-events", "all")
            .on("click", clicked);

        function clicked(event, p) {
            parent.datum(p.parent || root);

            root.each(d => d.target = {
                x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
                x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
                y0: Math.max(0, d.y0 - p.depth),
                y1: Math.max(0, d.y1 - p.depth)
            });

            const t = svg.transition().duration(750);

            path.transition(t)
                .tween("data", d => {
                    const i = d3.interpolate(d.current, d.target);
                    return t => d.current = i(t);
                })
                .filter(function(d) { return +this.getAttribute("fill-opacity") || arcVisible(d.target); })
                .attr("fill-opacity", d => arcVisible(d.target) ? (d.children ? 0.8 : 0.6) : 0)
                .attr("pointer-events", d => arcVisible(d.target) ? "auto" : "none")
                .attrTween("d", d => () => arc(d.current));

            label.filter(function(d) { return +this.getAttribute("fill-opacity") || labelVisible(d.target); })
                .transition(t)
                .attr("fill-opacity", d => +labelVisible(d.target))
                .attrTween("transform", d => () => labelTransform(d.current));
        }

        function arcVisible(d) { return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0; }
        function labelVisible(d) { return d.y1 <= 3 && d.y0 >= 1 && (d.x1 - d.x0) > 0.05; }
        function labelTransform(d) {
            const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
            const y = (d.y0 + d.y1) / 2 * radius;
            return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
        }
    }

    // Help Content
    const sunburstHelpContent = {
        title: "Reading the Sunburst",
        steps: [
            "<strong>Inner Ring:</strong> Continents.",
            "<strong>Outer Ring:</strong> Countries.",
            "<strong>Interaction:</strong> Click a region to zoom in. Click center to zoom out."
        ]
    };

    if (typeof createChartHelp === "function") {
        createChartHelp("#sunburts-help-container", "#sunburst-wrapper", sunburstHelpContent);
    } 

})();