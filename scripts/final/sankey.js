// File: sankey.js

(function() {

    // --- CONFIGURAZIONE ---
    const CSV_PATH = "../../data/final/trade-data/final_datasets/output_data.csv"; 
    
    // Configurazione Logica (Dimensioni interne per il calcolo Sankey)
    // Il CSS scalerà tutto, ma queste proporzioni determinano l'aspect ratio.
    const LOGICAL_WIDTH = 800;
    const LOGICAL_HEIGHT = 900;

    // Configurazione Soglie
    const MIN_PERCENTAGE = 0.03; 
    const TOP_N_COUNTRIES = 6;   

    let isUkraine = false; // False = Russia (Default)
    let globalRawData = null;

    // Colori
    const NODE_COLORS = {
        "Russia": "#d73027",      
        "Ukraine": "#4575b4",     
        "Rest of EU": "#999999",     
        "Other Products": "#d9d9d9", 

        "Natural Gas": "#f46d43", "Crude/Refined Petroleum": "#fdae61",
        "Cereals": "#abd9e9", "Oils Seeds & Oleaginous Fruits": "#74add1",
        "Metals": "#8073ac", "Wood": "#8c510a", "Chemicals": "#c51b7d",
        "Coal": "#4d4d4d", "Minerals": "#bab0ac", "Machines": "#dfc27d",
        "Seed Oils": "#35978f", "Precious stones, metals, & pearls": "#e7ba52",

        "Germany": "#1f77b4", "Italy": "#2ca02c", "Netherlands": "#ff7f0e",
        "Poland": "#9467bd", "Belgium": "#8c564b", "Spain": "#e377c2",
        "France": "#7f7f7f", "Hungary": "#bcbd22", "Romania": "#17becf",
        "Slovakia": "#aec7e8", "Bulgaria": "#ffbb78", "Czechia": "#98df8a",
        "Greece": "#c5b0d5", "Lithuania": "#c49c94", "Finland": "#f7b6d2"
    };
    
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

    function getColor(name) {
        return NODE_COLORS[name] || colorScale(name);
    }

    const formatMoney = (value) => {
        if (value >= 1e9) return "€" + (value / 1e9).toFixed(1) + "B";
        if (value >= 1e6) return "€" + (value / 1e6).toFixed(1) + "M";
        return "€" + value.toLocaleString();
    };

    // --- 1. OBSERVER INTERNO ---
    document.addEventListener("DOMContentLoaded", function() {
        const target = document.querySelector("#sankey-section");
        if(target) {
            const observer = new IntersectionObserver((entries, obs) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        console.log("Observer: Avvio Sankey...");
                        initSankey();
                        obs.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1 });
            observer.observe(target);
        }
    });

    // --- 2. INIT FUNCTION ---
    async function initSankey() {
        try {
            globalRawData = await d3.csv(CSV_PATH);
            setupControls();
            updateCharts();
        } catch (error) {
            console.error("Error Sankey:", error);
            d3.select("#sankey-controls").html(`<span style="color:red">Error loading data</span>`);
        }
    }

    // --- 3. CONTROLS SETUP (Standardizzato) ---
    function setupControls() {
        const container = d3.select("#sankey-controls");
        if(container.empty()) return;

        container.attr("class", "compact-menu-bar d-inline-flex align-items-center");
        container.html("");

        const options = [
            { label: "Russia", value: false }, // Value false -> isUkraine = false
            { label: "Ukraine", value: true }
        ];

        options.forEach((opt, index) => {
            const btn = container.append("button")
                .attr("class", "btn-compact")
                .text(opt.label)
                .on("click", function() {
                    container.selectAll(".btn-compact").classed("active", false);
                    d3.select(this).classed("active", true);
                    isUkraine = opt.value;
                    updateCharts();
                });

            // Set active state
            if (isUkraine === opt.value) btn.classed("active", true);

            if (index < options.length - 1) {
                container.append("div").attr("class", "compact-divider");
            }
        });
    }

    // --- 4. DATA PROCESSING ---
    function prepareSankeyData(rawCsv, year, targetPartner) {
        
        const yearData = rawCsv.filter(d => 
            d.PARTNER_LAB === targetPartner &&
            d.REPORTER_LAB !== 'European Union' &&
            +d.PERIOD_LAB === year
        );

        const totalImportValue = d3.sum(yearData, d => +d.INDICATOR_VALUE);
        const dynamicThreshold = totalImportValue * MIN_PERCENTAGE;

        // Reporters Logic
        const reporterTotals = d3.rollup(yearData, 
            v => d3.sum(v, d => +d.INDICATOR_VALUE), 
            d => d.REPORTER_LAB
        );
        
        const topReporters = Array.from(reporterTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, TOP_N_COUNTRIES) 
            .map(d => d[0]);

        // Products Logic
        const sectionTotals = d3.rollup(yearData,
            v => d3.sum(v, d => +d.INDICATOR_VALUE),
            d => d.Section
        );

        const productRenamingMap = new Map();
        sectionTotals.forEach((value, section) => {
            if (value < dynamicThreshold) {
                productRenamingMap.set(section, "Other Products");
            } else {
                productRenamingMap.set(section, section);
            }
        });

        // Build Links
        const linksMap = new Map();
        const nodeValues = new Map();

        yearData.forEach(row => {
            const val = +row.INDICATOR_VALUE;
            if (val <= 0) return;

            const partner = row.PARTNER_LAB; 
            const section = productRenamingMap.get(row.Section) || "Other Products";
            const reporter = topReporters.includes(row.REPORTER_LAB) ? row.REPORTER_LAB : "Rest of EU";

            // Update Link 1
            const key1 = `${partner}|${section}`;
            linksMap.set(key1, (linksMap.get(key1) || 0) + val);

            // Update Link 2
            const key2 = `${section}|${reporter}`;
            linksMap.set(key2, (linksMap.get(key2) || 0) + val);

            // Accumulate Node Values for Sorting
            nodeValues.set(partner, (nodeValues.get(partner) || 0) + val);
            nodeValues.set(section, (nodeValues.get(section) || 0) + val);
            nodeValues.set(reporter, (nodeValues.get(reporter) || 0) + val);
        });

        const links = [];
        const nodesSet = new Set();

        linksMap.forEach((value, key) => {
            const [source, target] = key.split("|");
            if(source && target) {
                links.push({ source, target, value });
                nodesSet.add(source);
                nodesSet.add(target);
            }
        });

        const nodes = Array.from(nodesSet)
            .map(name => ({ name: name, totalValue: nodeValues.get(name) || 0 }))
            .sort((a, b) => b.totalValue - a.totalValue); 

        return { nodes, links, totalValue: totalImportValue };
    }

    // --- 5. RENDERER ---
    function drawSankey(containerId, data) {
        const container = d3.select(containerId);
        container.html("");

        if (!data.nodes.length) {
            container.append("div").attr("class", "alert alert-light text-center").text("No significant data available.");
            return;
        }

        // Header interno al grafico
        container.append("div")
            .style("text-align", "center")
            .style("margin-bottom", "10px")
            .style("font-weight", "bold")
            .style("color", "#6c757d")
            .style("font-family", "'Fira Sans', sans-serif")
            .style("font-size", "14px")
            .html(`Total Volume: <span style="color:#000">${formatMoney(data.totalValue)}</span>`);

        // SVG FLUIDO
        // Usiamo dimensioni logiche per il calcolo, ma viewBox per la visualizzazione
        const svg = container.append("svg")
            .attr("viewBox", [0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT])
            .style("width", "100%")
            .style("height", "auto")
            .style("display", "block");

        const sankey = d3.sankey()
            .nodeId(d => d.name)
            .nodeWidth(15)
            .nodePadding(20)
            .extent([[1, 5], [LOGICAL_WIDTH - 1, LOGICAL_HEIGHT - 20]]) 
            .nodeAlign(d3.sankeyLeft)
            .iterations(64); 

        const graph = sankey({
            nodes: data.nodes.map(d => Object.assign({}, d)),
            links: data.links.map(d => Object.assign({}, d))
        });

        // --- LINKS ---
        const link = svg.append("g")
            .attr("fill", "none")
            .attr("stroke-opacity", 0.4)
            .selectAll("g")
            .data(graph.links)
            .join("g")
            .style("mix-blend-mode", "multiply")
            .classed("sankey-link", true);

        const defs = svg.append("defs");
        link.each(function(d) {
            d.uid = `link-${Math.random().toString(36).substr(2, 9)}`;
            const gradient = defs.append("linearGradient")
                .attr("id", d.uid)
                .attr("gradientUnits", "userSpaceOnUse")
                .attr("x1", d.source.x1)
                .attr("x2", d.target.x0);
            gradient.append("stop").attr("offset", "0%").attr("stop-color", getColor(d.source.name));
            gradient.append("stop").attr("offset", "100%").attr("stop-color", getColor(d.target.name));
        });

        const path = link.append("path")
            .attr("d", d3.sankeyLinkHorizontal())
            .attr("stroke", d => `url(#${d.uid})`)
            .attr("stroke-width", d => Math.max(1, d.width))
            .style("transition", "stroke-opacity 0.3s");

        path.append("title")
            .text(d => `${d.source.name} → ${d.target.name}\n${formatMoney(d.value)}`);

        // --- NODES ---
        const node = svg.append("g")
            .selectAll("rect")
            .data(graph.nodes)
            .join("rect")
            .attr("x", d => d.x0)
            .attr("y", d => d.y0)
            .attr("height", d => d.y1 - d.y0)
            .attr("width", d => d.x1 - d.x0)
            .attr("fill", d => getColor(d.name))
            .attr("stroke", "#000")
            .attr("stroke-opacity", 0.1)
            .style("cursor", "pointer");

        node.append("title").text(d => `${d.name}\n${formatMoney(d.value)}`);

        // --- LABELS ---
        svg.append("g")
            .style("font-family", "'Fira Sans', sans-serif")
            .style("font-size", "11px")
            .style("font-weight", "bold")
            .style("pointer-events", "none")
            .selectAll("text")
            .data(graph.nodes)
            .join("text")
            .attr("x", d => d.x0 < LOGICAL_WIDTH / 2 ? d.x1 + 6 : d.x0 - 6)
            .attr("y", d => (d.y1 + d.y0) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", d => d.x0 < LOGICAL_WIDTH / 2 ? "start" : "end")
            .text(d => d.name)
            .each(function(d) {
                // Nascondi etichetta se il nodo è troppo piccolo
                if (d.y1 - d.y0 < 15) this.style.display = "none";
            });

        // --- INTERATTIVITÀ (Highlight) ---
        const highlight = (d, type) => {
            const allPaths = svg.selectAll(".sankey-link path");
            if (type === "enter") {
                allPaths.style("stroke-opacity", 0.1);
                allPaths.filter(linkD => {
                    if (d.source && d.target) return linkD === d; 
                    return linkD.source.name === d.name || linkD.target.name === d.name; 
                }).style("stroke-opacity", 0.8);
            } else {
                allPaths.style("stroke-opacity", 0.4);
            }
        };

        node.on("mouseenter", (event, d) => highlight(d, "enter"))
            .on("mouseleave", (event, d) => highlight(d, "leave"));
            
        path.on("mouseenter", (event, d) => highlight(d, "enter"))
            .on("mouseleave", (event, d) => highlight(d, "leave"));
    }

    // --- UPDATE HELPER ---
    function updateCharts() {
        if (!globalRawData) return;
        const partner = isUkraine ? "Ukraine" : "Russia";
        
        const data2021 = prepareSankeyData(globalRawData, 2021, partner);
        const data2023 = prepareSankeyData(globalRawData, 2023, partner);

        drawSankey("#sankey-chart-2021", data2021);
        drawSankey("#sankey-chart-2023", data2023);
    }

})();