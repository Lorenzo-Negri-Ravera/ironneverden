// File: sankeyDiagram.js

const NODES_JSON_PATH = '../../data/lab6/sankey_nodes_EU_top.json';
const LINKS_JSON_PATH = '../../data/lab6/sankey_links_EU_top.json';

Promise.all([
    d3.json(NODES_JSON_PATH),
    d3.json(LINKS_JSON_PATH)
]).then(function([rawNodes, rawLinks]) {
    
// --- INIZIALIZZAZIONE GLOBALE (Dichiarazione corretta) ---
const width = 1000;
const height = 800;
const marginTop = 50;
const marginBottom = 20;
const marginLeft = 10;
const marginRight = 135;

// Seleziona il contenitore SVG e imposta le dimensioni iniziali
const svg = d3.select("#sankey-container")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .attr("style", "max-width: 100%; height: auto;");

// Inizializza il generatore di layout Sankey
const sankey = d3.sankey()
    .nodeId(d => d.index) 
    .nodeWidth(15)       
    .nodePadding(20)     
    .extent([[marginLeft, marginTop], [width - marginRight, height - marginBottom]]); 

// Scala di colori standard
const color = d3.scaleOrdinal(d3.schemeCategory10);



    // !!! ATTENZIONE: Qui SOTTO ho RIMOVERSO le dichiarazioni 'const' duplicate !!!

    // --- 1. Preparazione dei Dati ---

    const data = {
        nodes: rawNodes.map((d, i) => ({ ...d, index: i })), 
        links: rawLinks.map(d => ({ ...d }))
    };
    
    // --- 2. Calcolo del Layout Sankey (usa le variabili 'sankey' e 'data' globali) ---
    sankey(data);

    // --- 3. Titolo del Grafico (usa la variabile 'svg' globale) ---
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", marginTop / 2)
        .attr("text-anchor", "middle") 
        .style("font-size", "24px")
        .style("font-weight", "bold")
        .text("**titolo**");
                


    // --- 4. Disegno dei Flussi (Links) ---
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

    // Aggiungi un tooltip al passaggio del mouse sui flussi
    link.append("title")
        .text(d => `${d.source.label} → ${d.target.label}\nTotale Eventi: ${d.value.toLocaleString()}`);


    // --- 5. Disegno dei Nodi ---
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

    // --- 6. Etichette dei Nodi ---
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
    // Nota: l'oggetto 'svg' è disponibile, quindi se il caricamento fallisce si può aggiungere un messaggio
    if (svg) {
        svg.append("text")
        .attr("x", width / 2).attr("y", height / 2)
        .attr("text-anchor", "middle")
        .style("fill", "red")
        .text("Errore nel grafico: verificare i file JSON.");
    }
});