// File: waffle_chart.js

// Mapping of the JSON keys
const categories = [
    { key: "Pacific_protests", label: "Peaceful protest" },
    { key: "Protests_intervention", label: "Protest with intervention" },
    { key: "Excessive_force", label: "Excessive force against protesters" }
];

// Extraction of the labels
const categoryLabels = categories.map(c => c.label);

// Definition of the color for each label
const color = d3.scaleOrdinal()
    .domain(categoryLabels)
    .range(["#002677", "#F4633A", "#C8102E"]); // -> Dark Blue, Orange, Red

// Waffle grid size
const gridSize = 25; 
const gridCols = 10;
const totalSquares = 100;
const width =250;
const height = 250;


// Load the json files
Promise.all([
    d3.json("../../data/lab2/waffle_data_RU.json"),
    d3.json("../../data/lab2/waffle_data_UK.json")
]).then(function([dataRU, dataUK]) {

    d3.select("#main-container")
      .insert("h2", "#waffle-container")
      .attr("class", "graph-title")
      .style("text-align", "center")
      .text("Proportional composition of types of police intervention in protests");

    // Data Transformation: convert raw data to an array of 100 elements
    // - Computes the total protests
    // - Determines the percentage of each category and converts it to a number of squares
    // Returns an array of 100 objects; each object represents a square and its category
    function createWaffleArray(rawData) {
        const waffleArray = [];
        
        let total = 0;
        categories.forEach(cat => {
            total += rawData[cat.key] || 0; 
        });

        if (total === 0) return []; 

        categories.forEach((cat, i) => {
            const count = rawData[cat.key] || 0;
            
            // Calculate number of squares, rounding to nearest whole number
            let numSquares = Math.round((count / total) * totalSquares);
            
            // Ensure the total is exactly 100 by adjusting the last category
            if (i === categories.length - 1) {
                numSquares = totalSquares - waffleArray.length;
            }

            for(let k = 0; k < numSquares; k++) {
                waffleArray.push({ category: cat.label });
            }
        });
        
        // Final check to fill up to 100 squares if rounding left a gap
        while(waffleArray.length < totalSquares && waffleArray.length > 0) {
             waffleArray.push({ category: categories[categories.length - 1].label });
        }
        
        return waffleArray.slice(0, totalSquares);
    }
    

    // Definizione di una funzione per disegnare un Waffle chart
    function drawWaffle(svgSelector, waffleData, title) {
        // Seleziona il contenitore SVG esistente
        const svg = d3.select(svgSelector);

        // Definisci uno spazio per il titolo
        const gridTopMargin = 30; // 30px di spazio per il titolo

        // Calcola un piccolo offset per centrare la griglia orizzontalmente
        const gridWidth = gridCols * gridSize;
        const xOffset = Math.max(0, (width - gridWidth) / 2);

        svg.attr("width", width)
           // Regola l'altezza e la viewBox per includere il margine del titolo
           .attr("height", height + gridTopMargin)
           .attr("viewBox", [0, 0, width, height + gridTopMargin])
           .attr("style", "max-width: 100%; height: auto; display: block; margin: 0 auto;");
        
        // Aggiungi il titolo centrato
        svg.append("text")
           .attr("class", "graph-subtitle")
           .attr("x", width / 2) // Centra orizzontalmente
           .attr("y", 20)
           .attr("text-anchor", "middle")
           .text(title);

        // Costruzione del waffle chart
        svg.selectAll(".waffle-cell")
           .data(waffleData)
           .join("rect")
             .attr("class", "waffle-cell")
             .attr("x", (d, i) => (i % gridCols) * gridSize + xOffset)
             // Applica il margine superiore alla posizione Y della griglia
             .attr("y", (d, i) => Math.floor(i / gridCols) * gridSize + gridTopMargin) 
             .attr("width", gridSize - 1)
             .attr("height", gridSize - 1)
             .attr("fill", d => color(d.category))
             .style("stroke", "#fff") 
             .style("stroke-width", "1px")
           .append("title") 
             .text(d => d.category); 
    }

    // Build the charts
    const waffleDataRU = createWaffleArray(dataRU);
    const waffleDataUK = createWaffleArray(dataUK);


    // Draw the charts
    drawWaffle("#waffle-ru", waffleDataRU, "Russia");
    drawWaffle("#waffle-uk", waffleDataUK, "Ukraine");

    // Create legend
    const legendContainer = d3.select("#waffle-legend-container")
        .append("div")
        .attr("class", "legend-text");

    categories.forEach(cat => {
        const legendItem = legendContainer.append("div")
            .style("display", "inline-block")
            .style("margin-right", "20px");
        
        legendItem.append("span")
            .style("display", "inline-block")
            .style("width", "20px")
            .style("height", "20px")
            .style("background-color", color(cat.label))
            .style("margin-right", "5px")
            .style("vertical-align", "middle");
        
        legendItem.append("span")
            .text(cat.label)
            .style("vertical-align", "middle");
    });
    
}).catch(function(error) {
    console.error("Error loading JSON files:", error);
    d3.select("#waffle-charts-section") 
      .append("h2")
      .text("Error: could not load data. Make sure 'waffle_data_RU.json' and 'waffle_data_UK.json' are present.");
});
