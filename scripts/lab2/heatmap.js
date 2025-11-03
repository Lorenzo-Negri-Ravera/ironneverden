// File: heatmap.js

// Load the file json
d3.json("../../data/lab2/top15_countries_by_year.json").then(function(data) {
    
    const width = 600;
    const height = 640;
    const marginTop = 60;
    const marginRight = 110;
    const marginBottom = 40;
    const marginLeft = 110;

    // Extraction of the Heatmap data
    const allCountries = [];
    const countrySet = new Set();
    for (const d of data) {
        if (!countrySet.has(d.COUNTRY)) {
                countrySet.add(d.COUNTRY);
                allCountries.push(d.COUNTRY);
        }
    }
    const allYears = [...new Set(data.map(d => d.YEAR))].sort(d3.ascending);
    const maxCount = d3.max(data, d => d.count);

    // Defition of the axes
    const xScale = d3.scaleBand()
        .domain(allYears)
        .range([marginLeft, width - marginRight])
        .padding(0.05);

    const yScale = d3.scaleBand()
        .domain(allCountries)
        .range([marginTop, height - marginBottom])
        .padding(0.05);


    // Definition of the color
    const colorScale = d3.scaleLinear()
        .domain([0, maxCount])
        .range(["#fcd199ff", "#C8102E"]);     // from beige to red 

    // Define the SVG container and its dimensions
    const svg = d3.select("#heatmap-container")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto;");

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", marginTop / 2)
        .attr("text-anchor", "middle") 
        .attr("class", "graph-title")
        .text("Distribution of civil unrest and violence since 2017 in Europe and central Asia");

    // code for the colorbar
    const legendWidth = 15;
    const legendHeight = height - marginTop - marginBottom; 
    
    const legendX = width - marginRight + 20;
    const legendY = marginTop;

    const defs = svg.append("defs");

    const linearGradient = defs.append("linearGradient")
        .attr("id", "heatmap-gradient")
        .attr("x1", "0%")
        .attr("x2", "0%")
        .attr("y1", "0%")
        .attr("y2", "100%");

    linearGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", colorScale.range()[1]);

    linearGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", colorScale.range()[0]);

    svg.append("rect")
        .attr("x", legendX)
        .attr("y", legendY)
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#heatmap-gradient)");

    const legendScale = d3.scaleLinear()
        .domain([0, maxCount])
        .range([legendY + legendHeight, legendY]); 

    svg.append("g")
        .attr("class", "legend-axis")
        .attr("transform", `translate(${legendX + legendWidth + 5}, 0)`) 
        .call(d3.axisRight(legendScale)
            .ticks(5)
            .tickSize(3));

    svg.select(".legend-axis .domain").remove();

    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(xScale));

    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(d3.axisLeft(yScale));

    // Building of the heatmap
    svg.selectAll(".cell")
        .data(data)
        .join("rect")
            .attr("class", "cell")
            .attr("x", d => xScale(d.YEAR))
            .attr("y", d => yScale(d.COUNTRY))
            .attr("width", xScale.bandwidth())
            .attr("height", yScale.bandwidth())
            .attr("fill", d => colorScale(d.count))
        .append("title")
            .text(d => `Country: ${d.COUNTRY}\nYear: ${d.YEAR}\nCount: ${d.count}`);

}).catch(function(error) {
    console.error("Error loading ../../data/lab2/top15_countries_by_year.json:", error);
    svg.append("text").text("Error: could not load data.");
});