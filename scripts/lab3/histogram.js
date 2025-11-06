// File: histogram.js

// Load the json file
d3.json("../../data/lab3/ExplosionFatalities.json").then(function(data) {

    // --- 1. Data Filtering (NEW) ---
    // Filter for Ukraine and specific event type
    const filteredData = data.filter(d => {
        return d.COUNTRY === "Ukraine" && 
               d.EVENT_TYPE === "Explosions/Remote violence";
    });

    // --- 2. Data Preparation ---
    // Ensure FATALITIES is a number
    filteredData.forEach(d => {
        d.FATALITIES = +d.FATALITIES;
    });

    // --- 3. Setup SVG and Margins ---
    const width = 850;
    const height = 500;
    const marginTop = 60;
    const marginRight = 30;
    const marginBottom = 40;
    const marginLeft = 60; 

    // Select an existing SVG container
    const svg = d3.select("#histogram-container")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto;");
    
    // Add the title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", marginTop / 2.5)
        .attr("text-anchor", "middle") 
        .attr("class", "graph-title")
        // Title updated slightly to be more specific
        .text("Distribution of Fatalities from Explosions in Ukraine");

    // --- 4. Definition of the axes ---

    // X-axis scale (Linear for fatalities count)
    // Use filteredData to find max
    const xMax = d3.max(filteredData, d => d.FATALITIES);
    const x = d3.scaleLinear()
        .domain([0, xMax > 0 ? xMax : 1]).nice() 
        .range([marginLeft, width - marginRight]);
    
    // --- 5. Histogram Binning ---
    
    // Create a histogram generator
    const histogram = d3.histogram()
        .value(d => d.FATALITIES)   // Use FATALITIES as the value
        .domain(x.domain())       // Set the domain based on the x-scale
        .thresholds(x.ticks(20)); // Bins are linear

    // Apply the histogram generator to the filtered data
    const bins = histogram(filteredData);

    // --- 6. Y-axis scale (Sqrt for frequency) ---
    // Use bins (from filteredData) to find max
    const yMax = d3.max(bins, d => d.length);
    const y = d3.scaleSqrt() // Use Sqrt scale for Y-axis
        .domain([0, yMax > 0 ? yMax : 1]) 
        .range([height - marginBottom, marginTop]);

    // --- 7. Building of the histogram bars ---
    svg.append("g")
        .attr("fill", "#002677") // Using the dark blue color
      .selectAll("rect")
      .data(bins)
      .join("rect")
        .attr("x", d => x(d.x0) + 1) 
        .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1)) 
        .attr("y", d => y(d.length)) 
        .attr("height", d => y(0) - y(d.length)) 
      .append("title")
        .text(d => `Fatalities: [${d.x0}-${d.x1}]\nFrequency: ${d.length}`); 

    // --- 8. Draw Axes ---
    
    // Add the x-axis
    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(x).tickSizeOuter(0))
        .call(g => g.append("text") 
            .attr("x", marginLeft + (width - marginLeft - marginRight) / 2)
            .attr("y", marginBottom - 4)
            .attr("fill", "currentColor")
            .attr("text-anchor", "middle")
            .text("Number of Fatalities")); 

    // Add the y-axis
    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(d3.axisLeft(y).ticks(null, "s")) // Sqrt scale ticks
        .call(g => g.append("text")
            .attr("x", -marginLeft)
            .attr("y", marginTop - 10)
            .attr("fill", "currentColor")
            .attr("text-anchor", "start")
            .text("Frequency (Weeks) (Sqrt Scale)")); 

}).catch(function(error) {
    console.error("Error loading ../../data/lab3/ExplosionFatalities.json:", error);
    d3.select("#histogram-container") 
      .append("h2")
      .style("color", "red")
      .text("Error: could not load data. Make sure 'ExplosionFatalities.json' is present.");
});