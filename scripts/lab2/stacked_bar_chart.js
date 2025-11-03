// File: stacked_bar_chart.js

// Load the json file
d3.json("../../data/lab2/Year_Events_UK.json").then(function(data) {
    
    // Set sizes and margins
    const width = 928;
    const height = 500;
    const marginTop = 30;
    const marginRight = 150; 
    const marginBottom = 30;
    const marginLeft = 40;

    // Extraction of the data to build the stacked barchart
    const keys = [...new Set(data.map(d => d.EVENT_TYPE))];
    const groupedData = d3.group(data, d => d.YEAR);
    const wideData = Array.from(groupedData, ([year, values]) => {
        const obj = { YEAR: year };
        for (const key of keys) {
            const item = values.find(d => d.EVENT_TYPE === key);
            obj[key] = item ? item.count : 0;
        }
        return obj;
    });
    wideData.sort((a, b) => d3.ascending(a.YEAR, b.YEAR));     // sorting by year

    // Stack generator 
    const series = d3.stack()
        .keys(keys)
        .offset(d3.stackOffsetExpand) // This to create a 100% stacked chart
        .value((d, key) => d[key])
        (wideData);

    // Definition of the axes
    const x = d3.scaleBand()
        .domain(wideData.map(d => d.YEAR))
        .range([marginLeft, width - marginRight])
        .padding(0.1);

    const y = d3.scaleLinear()
        .domain([0, 1]) // (0% to 100%)
        .range([height - marginBottom, marginTop]);

    
    // Set the color
    const color = d3.scaleOrdinal()
        .domain(keys)
        .range(d3.schemeTableau10); 


    // Select the existing SVG container
    const svg = d3.select("#stacked-bar-chart-container")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto;");

    // Building of the stacked barchart
    svg.append("g")
      .selectAll()
      .data(series)
      .join("g")
        .attr("fill", d => color(d.key))
      .selectAll("rect")
      .data(D => D.map(d => (d.key = D.key, d))) 
      .join("rect")
        .attr("x", d => x(d.data.YEAR))
        .attr("y", d => y(d[1]))
        .attr("height", d => y(d[0]) - y(d[1]))
        .attr("width", x.bandwidth()) 
    .append("title")    // definition of a interactive tooltip to show information for each stack
      .text(d => {
          const originalData = d.data;
          const eventType = d.key;
          const count = originalData[eventType];
          let total = 0;
          keys.forEach(key => { total += originalData[key]; });
          const percent = (count / total * 100).toFixed(1);
          return `${originalData.YEAR} - ${eventType}\nCount: ${count} (${percent}%)`;
        });


    // Add the x-axis (year)
    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(x).tickSizeOuter(0));

    // Add the y-axis (percentage)
    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(d3.axisLeft(y).ticks(null, "%")) // Format as percentage
        .call(g => g.select(".domain").remove());
    

    // Build the legend
    const legend = svg.append("g")
        .attr("transform", `translate(${width - marginRight + 20}, ${marginTop})`);

    const legendGroups = legend.selectAll("g")
      .data(keys)
      .join("g")
        .attr("transform", (d, i) => `translate(0, ${i * 20})`);

    legendGroups.append("rect")
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", d => color(d)); 

    legendGroups.append("text")
        .attr("x", 20)
        .attr("y", 12) 
        .text(d => d) 
        .style("font-size", "12px")
        .style("font-family", "Arial, sans-serif");         // CHANGE WITH THE CORRECT FONT

}).catch(function(error) {
    console.error("Error loading ../../data/lab2/Year_Events_UK.json:", error);
    d3.select("#stacked-bar-chart-container") 
      .append("text")
      .text("Error: could not load data.");
});