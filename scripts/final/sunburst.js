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
    const width = 400;
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

    // --- 1. SETUP UI & LOADER (Come nel tuo geoChoropleth.js) ---
    
    // Selezioniamo il contenitore padre definito nell'HTML
    const wrapper = d3.select("#sunburst-wrapper");

    // Pulizia preventiva: rimuoviamo eventuali loader statici residui dall'HTML
    wrapper.selectAll(".chart-loader-overlay").remove();

    // CREAZIONE LOADER DINAMICA
    const loader = wrapper.append("div")
        .attr("class", "chart-loader-overlay")
        .style("display", "flex"); // Parte visibile di default

    loader.append("div").attr("class", "loader-spinner");

    // Helper Functions
    const showLoader = () => loader.style("display", "flex");
    const hideLoader = () => loader.style("display", "none");


    // --- 2. DATA PROCESSING ---
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
    }


    // --- 3. CARICAMENTO DATI ---
    Promise.all([
        d3.json(DATA_PATHS.UKR_2021),
        d3.json(DATA_PATHS.UKR_2023),
        d3.json(DATA_PATHS.RUS_2021),
        d3.json(DATA_PATHS.RUS_2023)
    ]).then(([ukr21, ukr23, rus21, rus23]) => {

        // Setup dati
        allData = {
            UKR: { 
                2021: processHierarchy(ukr21), 
                2023: processHierarchy(ukr23) 
            },
            RUS: { 
                2021: processHierarchy(rus21), 
                2023: processHierarchy(rus23) 
            }
        };

        // Render Iniziale
        updateDashboard();

        // Setup Toggle Listener
        d3.select("#country-toggle").on("change", function() {
            currentCountry = this.checked ? "RUS" : "UKR";
            updateDashboard();
        });

        // *** QUI NASCONDIAMO IL LOADER ***
        hideLoader();

    }).catch(err => {
        console.error("Errore caricamento dati sunburst:", err);
        // Feedback visuale errore (diventa rosso come nel tuo esempio)
        loader.select(".loader-spinner")
            .style("border-top-color", "red")
            .style("animation", "none");
        
        // Opzionale: Aggiungi testo errore
        loader.append("div")
            .style("color", "red")
            .style("margin-top", "10px")
            .text("Error loading data");
    });


    // --- 4. LOGICA DASHBOARD ---
    function updateDashboard() {
        d3.select("#chart-2021").selectAll("*").remove();
        d3.select("#chart-2023").selectAll("*").remove();

        const data21 = allData[currentCountry][2021];
        const data23 = allData[currentCountry][2023];

        createZoomableSunburst(data21, "#chart-2021", "#total-label-2021");
        createZoomableSunburst(data23, "#chart-2023", "#total-label-2023");
    }


    // --- 5. GENERATORE GRAFICO ---
    function createZoomableSunburst(data, selector, labelSelector) {
        
        const root = d3.hierarchy(data)
            .sum(d => d.value)
            .sort((a, b) => b.value - a.value);

        d3.partition()
            .size([2 * Math.PI, root.height + 1])
            (root);

        // Inizializza current per evitare errori
        root.each(d => d.current = d);

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

        const svg = d3.select(selector).append("svg")
            .attr("viewBox", [-width / 2, -width / 2, width, width])
            .style("font", "10px sans-serif");

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
                    if (d.current && textLength > (d.current.y1 - d.current.y0) * radius * 1.5) {
                        self.text(d.data.name.substring(0, 5) + "..");
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
                .filter(function(d) {
                    return +this.getAttribute("fill-opacity") || arcVisible(d.target);
                })
                .attr("fill-opacity", d => arcVisible(d.target) ? (d.children ? 0.8 : 0.6) : 0)
                .attr("pointer-events", d => arcVisible(d.target) ? "auto" : "none")
                .attrTween("d", d => () => arc(d.current));

            label.filter(function(d) {
                    return +this.getAttribute("fill-opacity") || labelVisible(d.target);
                }).transition(t)
                .attr("fill-opacity", d => +labelVisible(d.target))
                .attrTween("transform", d => () => labelTransform(d.current));
        }

        function arcVisible(d) {
            return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
        }

        function labelVisible(d) {
            return d.y1 <= 3 && d.y0 >= 1 && (d.x1 - d.x0) > 0.05;
        }

        function labelTransform(d) {
            const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
            const y = (d.y0 + d.y1) / 2 * radius;
            return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
        }
    }

    // How to read the chart
    const sunburstHelpContent = {
        title: "How to read the Map",
        steps: [
            "<strong>TODO</strong>",
            ]
        };

        if (typeof createChartHelp === "function") {
            createChartHelp("#sunburts-help-container", "#sunburst-wrapper", sunburstHelpContent);
        } else {
            console.warn("createChartHelp non trovata.");
        }

})();