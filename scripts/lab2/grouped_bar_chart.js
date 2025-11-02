// File: grouped_bar_chart.js

// Load the file json
d3.json("../../data/lab2/Events_UK_RU.json").then(function(data) {
    
    // Definition of the sizes and margins
    const width = 928;
    const height = 600;
    const marginTop = 30;
    const marginRight = 10;
    const marginBottom = 20;
    const marginLeft = 60;

    
    // Extraction of the events and countries
    const eventTypes = [...new Set(data.map(d => d.EVENT_TYPE))].sort(d3.ascending);
    const countries = [...new Set(data.map(d => d.COUNTRY))].sort();

    // Definition of the x axis
    const fx = d3.scaleBand()
        .domain(eventTypes)
        .rangeRound([marginLeft, width - marginRight])
        .paddingInner(0.1);

    const x = d3.scaleBand()
        .domain(countries)
        .rangeRound([0, fx.bandwidth()])
        .padding(0.05);

    // Color to encode Russia and Ukraine
    const color = d3.scaleOrdinal()
        .domain(countries)
        .range(d3.schemeCategory10); 

    // Definition of the y axis
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count)]).nice()
        .rangeRound([height - marginBottom, marginTop]);

    // Building of the SVG container
    const svg = d3.select("#grouped-bar-chart-container")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto;");

    // Building of the Grouped bar chart
    svg.append("g")
      .selectAll()
      .data(d3.group(data, d => d.EVENT_TYPE)) 
      .join("g")
        .attr("transform", ([eventType]) => `translate(${fx(eventType)},0)`) 
      .selectAll()
      .data(([, d]) => d) 
      .join("rect")
        .attr("x", d => x(d.COUNTRY))
        .attr("y", d => y(d.count))
        .attr("width", x.bandwidth())
        .attr("height", d => y(0) - y(d.count))
        .attr("fill", d => color(d.COUNTRY))
      .append("title")
      .text(d => `Type: ${d.EVENT_TYPE}\nCountry: ${d.COUNTRY}\nCount: ${d.count}`);

    // Append the x axis 
    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(fx).tickSizeOuter(0))
        .call(g => g.selectAll(".domain").remove());

    // Append the y axis 
    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(d3.axisLeft(y).ticks(null, "s"))
        .call(g => g.selectAll(".domain").remove());

    // Add and define a legend 
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - marginRight - 100}, ${marginTop})`);

    legend.selectAll("rect")
        .data(countries)
        .join("rect")
        .attr("x", 0)
        .attr("y", (d, i) => i * 20)
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", color);

    legend.selectAll("text")
        .data(countries)
        .join("text")
        .attr("x", 20)
        .attr("y", (d, i) => i * 20 + 12) 
        .text(d => d)
        .attr("class", "legend-text");   

}).catch(function(error) {
    console.error("Error loading Events_UK_RU.json:", error);
    d3.select("#uk-ru-chart-container") 
      .append("text")
      .text("Error: could not load data.");
});