// File: histogram.js

// Load the json file
d3.json("../../data/lab3/ExplosionFatalities.json").then(function(data) {

    // Margins and sizes
    const width = 1000;
    const height = 600;
    const marginTop = 60;
    const marginRight = 50; 
    const marginBottom = 70;
    const marginLeft = 50;

    // Build the SVG container
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
        .text("Fatalities distribution caused by Explosions in Ukraine");

    // Definition of the axis 
    // x-axis
    const xMax = d3.max(data, d => d.FATALITIES);
    const x = d3.scaleLinear()
        .domain([0, xMax > 0 ? xMax : 1]).nice() 
        .range([marginLeft, width - marginRight]);
    

    // Create a histogram 
    const histogram = d3.histogram()
        .value(d => d.FATALITIES)   
        .domain(x.domain())       
        .thresholds(x.ticks(20)); 

    // Apply the histogram generator to the filtered data
    //const bins = histogram(filteredData);
    const bins = histogram(data);

    // y-axis 
    const yMax = d3.max(bins, d => d.length);
    const y = d3.scaleSqrt() // Use Sqrt scale for Y-axis
        .domain([0, yMax > 0 ? yMax : 1]) 
        .range([height - marginBottom, marginTop]);

    // Building of the histogram  
    svg.append("g")
        .attr("fill", "#002677")
      .selectAll("rect")
      .data(bins)
      .join("rect")
        .attr("x", d => x(d.x0) + 1) 
        .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1)) 
        .attr("y", d => y(d.length)) 
        .attr("height", d => y(0) - y(d.length)) 
      .append("title")
        .text(d => `Fatalities: [${d.x0}-${d.x1}]\nFrequency: ${d.length}`); 

    
    // Add the x-axis
    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(x).tickSizeOuter(0))
        .call(g => g.append("text") 
            .attr("x", marginLeft + (width - marginLeft - marginRight) / 2)
            .attr("y", marginBottom -20)
            .attr("fill", "currentColor")
            .attr("text-anchor", "middle")
            .text("Number of Fatalities")); 

    // Add the y-axis
    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(d3.axisLeft(y).ticks(null, "s")) 
        .call(g => g.append("text")
            .attr("x", -marginLeft)
            .attr("y", marginTop - 10)
            .attr("fill", "currentColor")
            .attr("text-anchor", "start")
            .text("Frequency (Sqrt Scale)")); 

}).catch(function(error) {
    console.error("Error loading ../../data/lab3/ExplosionFatalities.json:", error);
    d3.select("#histogram-container") 
      .append("h2")
      .style("color", "red")
      .text("Error: could not load data. Make sure 'ExplosionFatalities.json' is present.");
});