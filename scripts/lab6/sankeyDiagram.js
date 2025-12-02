// File: sankeyDiagram.js

const NODES_JSON_PATH = '../../data/lab6/sankey_nodes_EU_top.json';
const LINKS_JSON_PATH = '../../data/lab6/sankey_links_EU_top.json';

// *** NUOVO: Stili CSS per il tooltip fluttuante ***
// Lo iniettiamo dinamicamente per non dipendere da file CSS esterni
const tooltipStyle = document.createElement('style');
tooltipStyle.innerHTML = `
    .sankey-tooltip {
        position: absolute;
        text-align: left;
        padding: 12px;
        font: 12px sans-serif;
        background: white;
        border: 1px solid #ccc;
        border-radius: 5px;
        pointer-events: none; /* Il mouse ignora il box per evitare sfarfallii */
        opacity: 0;
        box-shadow: 2px 2px 10px rgba(0,0,0,0.2);
        z-index: 100;
        max-width: 300px;
    }
    .tooltip-header { font-weight: bold; font-size: 14px; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px;}
    .tooltip-section { font-weight: bold; margin-top: 8px; color: #555; }
    .tooltip-item { display: flex; justify-content: space-between; }
`;
document.head.appendChild(tooltipStyle);

// *** NUOVO: Creazione del DIV del tooltip ***
const tooltip = d3.select("body").append("div")
    .attr("class", "sankey-tooltip");


Promise.all([
    d3.json(NODES_JSON_PATH),
    d3.json(LINKS_JSON_PATH)
]).then(function([rawNodes, rawLinks]) {
        
    // Definition of dimensions and margins
    const width = 1000;
    const height = 800;
    const marginTop = 50;
    const marginBottom = 20;
    const marginLeft = 10;
    const marginRight = 135;

    // Build the SVG container
    const svg = d3.select("#sankey-container")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto;");

    // Initialize the Sankey generator
    const sankey = d3.sankey()
        .nodeId(d => d.index) 
        .nodeWidth(15)       
        .nodePadding(20)     
        .extent([[marginLeft, marginTop], [width - marginRight, height - marginBottom]]); 

    // Color scale
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    // Prepare data in the format required by d3-sankey
    const data = {
        nodes: rawNodes.map((d, i) => ({ ...d, index: i })), 
        links: rawLinks.map(d => ({ ...d }))
    };
    
    // Calcolo del layout Sankey
    sankey(data);

    // Title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", marginTop / 2)
        .attr("text-anchor", "middle") 
        .style("font-size", "24px")
        .style("font-weight", "bold")
        .text("Contribution of the Top 10 Countries to Disorder Events");
                

    // --- Draw the Sankey diagram ---

    // --- LINKS (Flussi) ---
    const linkGroup = svg.append("g")
        .attr("fill", "none")
        .attr("stroke-opacity", 0.5) // Opacità base
        .style("mix-blend-mode", "multiply");

    const links = linkGroup.selectAll("path")
      .data(data.links)
      .join("path")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", d => color(d.source.label)) 
        .attr("stroke-width", d => Math.max(1, d.width))
        .attr("class", "sankey-link"); // Classe utile per la selezione

    // *** NUOVO: Interazione sui LINKS ***
    links
        .on("mouseover", function(event, d) {
            // 1. Highlight: Oscura gli altri links
            links.transition().duration(200)
                .attr("stroke-opacity", link => link === d ? 0.7 : 0.1);

            // 2. Tooltip content
            const htmlContent = `
                <div class="tooltip-header">${d.source.label} $\to$ ${d.target.label}</div>
                <div>Totale Eventi: <b>${d.value.toLocaleString()}</b></div>
            `;

            // 3. Show Tooltip
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(htmlContent)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mousemove", function(event) {
            // Tooltip segue il mouse
            tooltip
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            // Reset Highlight e Tooltip
            links.transition().duration(200).attr("stroke-opacity", 0.5);
            tooltip.transition().duration(200).style("opacity", 0);
        });


    // --- NODES (Rettangoli) ---
    const nodeGroup = svg.append("g")
        .attr("stroke", "#000");

    const nodes = nodeGroup.selectAll("rect")
      .data(data.nodes)
      .join("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => d.y1 - d.y0)
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", d => color(d.label));
      // .append("title") // *** RIMOSSO: Usiamo il tooltip personalizzato ora

    // *** NUOVO: Interazione sui NODI ***
    nodes
        .on("mouseover", function(event, d) {
            // 1. Highlight: Evidenzia i link connessi a questo nodo
            // D3 Sankey aggiunge automaticamente sourceLinks e targetLinks a ogni nodo
            const connectedLinks = new Set([...d.sourceLinks, ...d.targetLinks]);

            links.transition().duration(200)
                .attr("stroke-opacity", link => connectedLinks.has(link) ? 0.7 : 0.05);

            // 2. Tooltip content per il NODO (più complesso)
            
            // Ordiniamo i flussi per valore
            const incoming = d.targetLinks.sort((a,b) => b.value - a.value);
            const outgoing = d.sourceLinks.sort((a,b) => b.value - a.value);

            let htmlContent = `
                <div class="tooltip-header" style="border-color: ${color(d.label)}">${d.label}</div>
                <div>Valore Totale: <b>${d.value.toLocaleString()}</b></div>
            `;

            if (incoming.length > 0) {
                htmlContent += `<div class="tooltip-section">Incoming:</div>`;
                incoming.forEach(l => {
                     htmlContent += `<div class="tooltip-item"><span>${l.source.label}</span> <b>${l.value.toLocaleString()}</b></div>`;
                });
            }

            if (outgoing.length > 0) {
                htmlContent += `<div class="tooltip-section">Outgoing:</div>`;
                outgoing.forEach(l => {
                     htmlContent += `<div class="tooltip-item"><span>${l.target.label}</span> <b>${l.value.toLocaleString()}</b></div>`;
                });
            }

            // 3. Show Tooltip
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(htmlContent)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mousemove", function(event) {
            tooltip
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
             // Reset Highlight e Tooltip
            links.transition().duration(200).attr("stroke-opacity", 0.5);
            tooltip.transition().duration(200).style("opacity", 0);
        });

    
    // Node Labels
    svg.append("g")
        .style("font", "10px sans-serif")
      .selectAll("text")
      .data(data.nodes)
      .join("text")
        .attr("x", d => d.x1 + 6) 
        .attr("y", d => (d.y0 + d.y1) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "start")
        .text(d => d.label);
        

}).catch(function(error) {
    console.error("Errore critico nel caricamento o nell'elaborazione dei dati Sankey:", error);
    if (d3.select("#sankey-container")) {
        d3.select("#sankey-container").append("text")
        .attr("x", 500).attr("y", 400) // Coordinate fisse basate su width/height
        .attr("text-anchor", "middle")
        .style("fill", "red")
        .text("Errore nel grafico: verificare i file JSON o la console.");
    }
});