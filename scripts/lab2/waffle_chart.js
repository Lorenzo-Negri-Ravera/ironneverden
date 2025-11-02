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
    .range(["#4daf4a", "#ff7f00", "#e41a1c"]); // -> Green, Orange, Red

// Waffle grid size
const gridSize = 25; 
const gridCols = 10;
const totalSquares = 100;


// Load the json files
Promise.all([
    d3.json("../../data/lab2/waffle_data_RU.json"),
    d3.json("../../data/lab2/waffle_data_UK.json")
]).then(function([dataRU, dataUK]) {
    
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
    

    // Definition of a function to draw a Waffle chart
    function drawWaffle(svgSelector, waffleData) {
        // Select the existing SVG container
        const svg = d3.select(svgSelector);

        svg.attr("width", 250)
           .attr("height", 250);
        
        // Building of the waffle chart
        svg.selectAll(".waffle-cell")
           .data(waffleData)
           .join("rect")
             .attr("class", "waffle-cell")
             .attr("x", (d, i) => (i % gridCols) * gridSize)
             .attr("y", (d, i) => Math.floor(i / gridCols) * gridSize)
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
    drawWaffle("#waffle-ru", waffleDataRU);
    drawWaffle("#waffle-uk", waffleDataUK);

    // Build the legend
    const legendContainer = d3.select("#waffle-legend-container");
    
    legendContainer.html(""); 

    categories.forEach(cat => {
        const item = legendContainer.append("div")
            .style("display", "flex")
            .style("align-items", "center")
            .style("margin-bottom", "5px");

        item.append("div")
            .style("width", "18px")
            .style("height", "18px")
            .style("margin-right", "8px")
            .style("border", "1px solid #ccc")
            .style("background-color", color(cat.label));

        item.append("span")
            .attr("class", "legend-text")
            .text(cat.label);
    });

}).catch(function(error) {
    console.error("Error loading JSON files:", error);
    d3.select("#waffle-charts-section") 
      .append("h2")
      .text("Error: could not load data. Make sure 'waffle_data_RU.json' and 'waffle_data_UK.json' are present.");
});
