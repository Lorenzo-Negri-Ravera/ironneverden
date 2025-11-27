// File: sankeyDiagram.js

const NODES_JSON_PATH = '../../data/lab6/sankey_nodes_EU_top.json';
const LINKS_JSON_PATH = '../../data/lab6/sankey_links_EU_top.json';

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

    // Links
    const link = svg.append("g")
        .attr("fill", "none")
        .attr("stroke-opacity", 0.5)
      .selectAll("g")
      .data(data.links)
      .join("g")
        .style("mix-blend-mode", "multiply");

    link.append("path")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", d => color(d.source.label)) 
        .attr("stroke-width", d => Math.max(1, d.width))
        .attr("class", "sankey-link");

    link.append("title")
        .text(d => `${d.source.label} → ${d.target.label}\nTotale Eventi: ${d.value.toLocaleString()}`);


    // Nodes
    const node = svg.append("g")
        .attr("stroke", "#000")
      .selectAll("rect")
      .data(data.nodes)
      .join("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => d.y1 - d.y0)
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", d => color(d.label)) 
      .append("title")
        .text(d => `${d.label}\nTotale Flusso: ${d.value.toLocaleString()}`);
    
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
    if (svg) {
        svg.append("text")
        .attr("x", width / 2).attr("y", height / 2)
        .attr("text-anchor", "middle")
        .style("fill", "red")
        .text("Errore nel grafico: verificare i file JSON.");
    }
});