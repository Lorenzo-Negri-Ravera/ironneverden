// File: bar_chart.js
// Extracted and adapted from the HTML file for a simple bar chart.

// NOTE: The JSON file path has been updated to match
// the structure of the other scripts (e.g., heatmap.js, grouped_bar_chart.js).
d3.json("../../data/lab2/Events_Ukraine.json").then(function(data) {
    
    // Setting the dimensions
    const width = 928;
    const height = 500;
    const marginTop = 30;
    const marginRight = 0;
    const marginBottom = 30;
    const marginLeft = 60; 

    // Set the scales / axes
    const xDomain = [...new Set(data.map(d => d.YEAR))].sort(d3.ascending);
    const x = d3.scaleBand()
        .domain(xDomain) 
        .range([marginLeft, width - marginRight])
        .padding(0.1);
    
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, (d) => d.count)]) 
        .range([height - marginBottom, marginTop]);

    // --- KEY CHANGE ---
    // Instead of d3.create("svg"), we select an existing SVG container
    // in the HTML file, just like the other scripts do.
    // Make sure you have <svg id="bar-chart-container"></svg> in your HTML.
    const svg = d3.select("#bar-chart-container")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto;");

    // Add a rectangle for each bar
    svg.append("g")
        .attr("fill", "steelblue") 
      .selectAll()
      .data(data)
      .join("rect")
        .attr("x", (d) => x(d.YEAR))     
        .attr("y", (d) => y(d.count))     
        .attr("height", (d) => y(0) - y(d.count))
        .attr("width", x.bandwidth())
    
    // Add the tooltip
    .append("title")
      // Tooltip text translated (and fixed missing newline)
      .text(d => `Year: ${d.YEAR}\nEvents: ${d.count}`); 

    // Add the x-axis
    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(x).tickSizeOuter(0));

    // Add the y-axis
    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(d3.axisLeft(y)) 
        // .call(g => g.select(".domain").remove()) // Kept as-is
        .call(g => g.append("text")
            .attr("x", -marginLeft)
            .attr("y", 10)
            .attr("fill", "currentColor")
            .attr("text-anchor", "start")
            .text("Number of Events")); // Axis label

    // --- KEY CHANGE ---
    // The 'document.body.appendChild(svg.node());' line was removed
    // because we are now selecting an existing SVG.

}).catch(function(error) {
    // Update the path in the error and the container selector
    console.error("Error loading ../../data/lab2/Events_Ukraine.json:", error);
    d3.select("#bar-chart-container") // Select the container to show the error
      .append("text")
      .text("Error: could not load data."); // Error message translated
});
