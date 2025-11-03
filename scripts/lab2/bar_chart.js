// File: bar_chart.js

// Load the json file
d3.json("../../data/lab2/Events_Ukraine.json").then(function(data) {

    // Setting sizes and margins
    const width = 850;
    const height = 500;
    const marginTop = 60;
    const marginRight = 0;
    const marginBottom = 30;
    const marginLeft = 60; 

    // Extract the year data
    const xDomain = [...new Set(data.map(d => d.YEAR))].sort(d3.ascending);

    // Definition of the axes
    const x = d3.scaleBand()
        .domain(xDomain) 
        .range([marginLeft, width - marginRight])
        .padding(0.1);
    
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, (d) => d.count)]) 
        .range([height - marginBottom, marginTop]);


    // Select an existing SVG container
    const svg = d3.select("#bar-chart-container")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto;");
    
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", marginTop / 2.5)
        .attr("text-anchor", "middle") 
        .attr("class", "graph-title")
        .text("Temporal trend of civil unrest and violence events in Ukraine since 2017");

    // Building of the barchart
    svg.append("g")
        .attr("fill", "#002677") 
      .selectAll()
      .data(data)
      .join("rect")
        .attr("x", (d) => x(d.YEAR))     
        .attr("y", (d) => y(d.count))     
        .attr("height", (d) => y(0) - y(d.count))
        .attr("width", x.bandwidth())    
    .append("title")
      .text(d => `Year: ${d.YEAR}\nEvents: ${d.count}`); 

    // Add the x-axis
    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(x).tickSizeOuter(0));

    // Add the y-axis
    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(d3.axisLeft(y)) 
        .call(g => g.append("text")
            .attr("x", -marginLeft)
            .attr("y", marginTop - 10)
            .attr("fill", "currentColor")
            .attr("text-anchor", "start")
            .text("Number of Events")); 

}).catch(function(error) {
    console.error("Error loading ../../data/lab2/Events_Ukraine.json:", error);
    d3.select("#bar-chart-container") 
      .append("text")
      .text("Error: could not load data."); 
});